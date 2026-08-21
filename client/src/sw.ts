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
  const options: NotificationOptions = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── 알림 탭 시 앱 열기/포커스 ─────────────────────────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
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
