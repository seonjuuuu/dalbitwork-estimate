import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { trpc } from '@/lib/trpc';

const ENABLED_KEY = 'dalbit-desktop-notifications-enabled';
const LAST_SEEN_KEY = 'dalbit-notification-last-seen-id';
const POLL_INTERVAL_MS = 20000;

// electron/main.cjs가 구글 로그인 통과를 위해 UA를 일반 크롬처럼 위장하면서,
// 기본 "Electron/x.y.z" 문자열 대신 자체적으로 붙여둔 "DalbitDesktopApp" 마커로 판별함
export function isElectronApp(): boolean {
  return typeof navigator !== 'undefined' && /DalbitDesktopApp/i.test(navigator.userAgent);
}

type DesktopNotificationContextValue = {
  isElectron: boolean;
  permission: NotificationPermission;
  enabled: boolean;
  requestEnable: () => Promise<boolean>;
  disable: () => void;
};

const DesktopNotificationContext = createContext<DesktopNotificationContextValue | null>(null);

/**
 * Electron 데스크탑 앱은 브라우저의 웹 푸시(PushManager)를 지원하지 않으므로,
 * 앱이 켜져 있는 동안 서버에 새 알림 이벤트가 있는지 주기적으로 확인해서
 * Electron이 그대로 macOS 알림센터로 넘겨주는 Notification API로 띄운다.
 */
export function DesktopNotificationProvider({ children }: { children: ReactNode }) {
  const isElectron = isElectronApp();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [enabled, setEnabled] = useState(() => localStorage.getItem(ENABLED_KEY) === '1');
  const [sinceId, setSinceId] = useState<number>(() => {
    const stored = localStorage.getItem(LAST_SEEN_KEY);
    return stored ? Number(stored) : 0;
  });

  const active = isElectron && enabled && permission === 'granted';

  const { data: events } = trpc.push.pollEvents.useQuery(
    { sinceId },
    { enabled: active, refetchInterval: active ? POLL_INTERVAL_MS : false, refetchOnWindowFocus: false }
  );

  useEffect(() => {
    if (!events || events.length === 0) return;
    for (const evt of events) {
      try {
        new Notification(evt.title, { body: evt.body });
      } catch {
        /* Electron이 아니거나 권한이 없으면 무시 */
      }
    }
    const maxId = events.reduce((m, e) => Math.max(m, e.id), sinceId);
    setSinceId(maxId);
    localStorage.setItem(LAST_SEEN_KEY, String(maxId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const requestEnable = async (): Promise<boolean> => {
    if (!isElectron || typeof Notification === 'undefined') return false;
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== 'granted') return false;
    setEnabled(true);
    localStorage.setItem(ENABLED_KEY, '1');
    return true;
  };

  const disable = () => {
    setEnabled(false);
    localStorage.setItem(ENABLED_KEY, '0');
  };

  return (
    <DesktopNotificationContext.Provider value={{ isElectron, permission, enabled, requestEnable, disable }}>
      {children}
    </DesktopNotificationContext.Provider>
  );
}

export function useDesktopNotification() {
  const ctx = useContext(DesktopNotificationContext);
  if (!ctx) throw new Error('useDesktopNotification must be used within DesktopNotificationProvider');
  return ctx;
}
