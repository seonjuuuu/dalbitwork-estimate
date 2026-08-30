import { ImapFlow } from "imapflow";
import { ENV } from "./_core/env";
import * as db from "./db";
import { notifyUser } from "./push";

const FETCH_COUNT = 20;

/** 등록된 고객 이메일로부터 온 새 메일이 있는지 확인하고, 새 메일이면 알림을 보낸다 (본문은 절대 읽지 않음)
 *  IMAP ENVELOPE 조회만 사용 — 발신자·제목·날짜 같은 헤더 정보만 가져오고 메일 본문은 요청하지 않음.
 *  발송용으로 이미 쓰고 있는 Gmail 앱 비밀번호를 그대로 재사용해서, OAuth 심사/토큰 만료 없이 영구적으로 동작. */
export async function checkNewClientEmails(userId: number) {
  const clientEmails = await db.listClientContactEmails(userId);
  if (clientEmails.length === 0) return { checked: 0, notified: 0 };
  const clientEmailSet = new Set(clientEmails);

  if (!ENV.gmailUser || !ENV.gmailAppPassword) {
    throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD가 설정되지 않았습니다.");
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: ENV.gmailUser, pass: ENV.gmailAppPassword },
    logger: false,
  });

  let notified = 0;
  let checked = 0;

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", { messages: true });
      const total = status.messages ?? 0;
      if (total === 0) return { checked: 0, notified: 0 };

      const start = Math.max(1, total - FETCH_COUNT + 1);
      for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, uid: true })) {
        checked++;
        const envelope = msg.envelope;
        if (!envelope) continue;

        const messageKey = envelope.messageId || `uid-${msg.uid}`;
        const alreadyNotified = await db.isGmailMessageNotified(messageKey);
        if (alreadyNotified) continue;

        const fromAddress = (envelope.from?.[0]?.address || "").trim().toLowerCase();
        const subject = envelope.subject || "(제목 없음)";
        const isClientEmail = clientEmailSet.has(fromAddress);
        const clientName = isClientEmail ? await db.findClientNameByEmail(userId, fromAddress) : null;

        // 등록된 고객 이메일이 아니면 알림 대상이 아니지만, 다음 폴링 때 또 확인하지 않도록
        // 처리한 메일로 기록은 남겨서 매번 다시 조회하지 않게 한다.
        await db.markGmailMessageNotified(userId, messageKey, fromAddress, subject, isClientEmail, clientName);
        if (!isClientEmail) continue;

        await notifyUser(userId, {
          title: "새 메일 도착",
          body: `${clientName || fromAddress}님이 메일을 보냈어요: ${subject}`,
          url: "/",
        });
        notified++;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return { checked, notified };
}
