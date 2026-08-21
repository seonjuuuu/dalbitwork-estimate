import webpush from "web-push";
import { ENV } from "./_core/env";
import * as db from "./db";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!ENV.vapidPublicKey || !ENV.vapidPrivateKey) {
    throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY가 설정되지 않았습니다. .env를 확인해주세요.");
  }
  webpush.setVapidDetails(ENV.vapidSubject, ENV.vapidPublicKey, ENV.vapidPrivateKey);
  configured = true;
}

/** 특정 유저의 모든 구독 기기에 알림을 보낸다. 만료된 구독은 자동으로 정리한다. */
export async function sendPushToUser(
  userId: number,
  payload: { title: string; body: string; url?: string }
) {
  ensureConfigured();
  const subs = await db.listPushSubscriptions(userId);

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      )
    )
  );

  await Promise.all(
    results.map(async (r, i) => {
      if (r.status === "rejected") {
        const statusCode = (r.reason as { statusCode?: number })?.statusCode;
        // 구독이 만료/취소된 경우(410 Gone, 404 Not Found) DB에서 정리
        if (statusCode === 410 || statusCode === 404) {
          await db.deletePushSubscriptionByEndpoint(subs[i].endpoint);
        }
      }
    })
  );

  return {
    sent: results.filter((r) => r.status === "fulfilled").length,
    total: subs.length,
  };
}

/**
 * 알림 이벤트를 기록하고(폴링 클라이언트용) 웹 푸시 구독이 있는 기기에도 함께 보낸다.
 * 데스크탑 앱처럼 웹 푸시를 지원하지 않는 클라이언트는 이벤트 기록만으로 폴링을 통해 받아간다.
 */
export async function notifyUser(
  userId: number,
  payload: { title: string; body: string; url?: string }
) {
  const event = await db.insertNotificationEvent(userId, payload);
  try {
    const result = await sendPushToUser(userId, payload);
    return { event, ...result };
  } catch {
    // VAPID 미설정 등으로 웹 푸시 발송에 실패해도 이벤트 기록(폴링용)은 이미 남았으므로 무시
    return { event, sent: 0, total: 0 };
  }
}
