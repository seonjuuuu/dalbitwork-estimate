import { ENV } from "./_core/env";
import * as db from "./db";
import { notifyUser } from "./push";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) {
    return cachedAccessToken.token;
  }
  if (!ENV.gmailMetadataClientId || !ENV.gmailMetadataClientSecret || !ENV.gmailMetadataRefreshToken) {
    throw new Error("GMAIL_METADATA_* 환경변수가 설정되지 않았습니다.");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENV.gmailMetadataClientId,
      client_secret: ENV.gmailMetadataClientSecret,
      refresh_token: ENV.gmailMetadataRefreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Gmail 토큰 갱신 실패: ${await res.text()}`);
  }
  const data = await res.json();
  cachedAccessToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedAccessToken.token;
}

function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match ? match[1] : fromHeader).trim().toLowerCase();
}

/** 등록된 고객 이메일로부터 온 새 메일이 있는지 확인하고, 새 메일이면 알림을 보낸다 (본문은 절대 읽지 않음)
 *  gmail.metadata 권한은 검색(q) 파라미터를 지원하지 않아서, 최근 받은편지함 메일을 가져온 뒤
 *  From 헤더를 서버에서 직접 등록된 고객 이메일 목록과 대조한다. */
export async function checkNewClientEmails(userId: number) {
  const clientEmails = await db.listClientContactEmails(userId);
  if (clientEmails.length === 0) return { checked: 0, notified: 0 };
  const clientEmailSet = new Set(clientEmails);

  const accessToken = await getAccessToken();

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) {
    throw new Error(`Gmail 메시지 목록 조회 실패: ${await listRes.text()}`);
  }
  const listData = await listRes.json();
  const messages: { id: string }[] = listData.messages || [];

  let notified = 0;
  for (const msg of messages) {
    const alreadyNotified = await db.isGmailMessageNotified(msg.id);
    if (alreadyNotified) continue;

    const metaRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!metaRes.ok) continue;
    const meta = await metaRes.json();
    const headers: { name: string; value: string }[] = meta.payload?.headers || [];
    const fromHeader = headers.find((h) => h.name === "From")?.value || "";
    const subject = headers.find((h) => h.name === "Subject")?.value || "(제목 없음)";
    const fromAddress = extractEmailAddress(fromHeader);
    const isClientEmail = clientEmailSet.has(fromAddress);
    const clientName = isClientEmail ? await db.findClientNameByEmail(userId, fromAddress) : null;

    // 등록된 고객 이메일이 아니면 알림 대상이 아니지만, 다음 폴링 때 또 확인하지 않도록
    // 처리한 메일로 기록은 남겨서 매번 다시 조회하지 않게 한다.
    await db.markGmailMessageNotified(userId, msg.id, fromAddress, subject, isClientEmail, clientName);
    if (!isClientEmail) continue;

    await notifyUser(userId, {
      title: "새 메일 도착",
      body: `${clientName || fromAddress}님이 메일을 보냈어요: ${subject}`,
      url: "/",
    });
    notified++;
  }

  return { checked: messages.length, notified };
}
