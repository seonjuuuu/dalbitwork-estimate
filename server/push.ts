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
