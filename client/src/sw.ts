/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// vite-plugin-pwa(injectManifest)가 빌드 시 이 자리에 프리캐시할 파일 목록을 주입
precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
self.addEventListener('activate', () => self.clients.claim());

// ─── 푸시 알림 수신 ────────────────────────────────────────────────
self.addEventListener('push', (event: PushEvent) => {
  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: '달빛워크 어드민', body: event.data?.text() || '' };
  }

  const title = payload.title || '달빛워크 어드민';
  const options: NotificationOptions & { renotify?: boolean } = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: payload.url || '/' },
    // 안 읽은 알림이 계속 쌓여서(예: 매일 아침 알림) 기기 뱃지 숫자가 안 없어지는 걸 방지:
    // 같은 tag로 이전 알림을 대체해서 항상 최신 1개만 남긴다
    tag: 'dalbit-notification',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── 알림 탭 시 앱 열기/포커스 ─────────────────────────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      // 혹시 남아있는 다른 알림도 함께 정리 (기기 아이콘 뱃지 숫자가 계속 남는 문제 방지)
      const remaining = await self.registration.getNotifications();
      remaining.forEach((n) => n.close());

      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = allClients.find((c) => 'focus' in c);
      if (existing) {
        await (existing as WindowClient).focus();
        if ('navigate' in existing) {
          try { await (existing as WindowClient).navigate(targetUrl); } catch { /* ignore */ }
        }
      } else {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
