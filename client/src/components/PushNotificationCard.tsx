import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(Array.from(rawData).map((c) => c.charCodeAt(0)));
}

type SupportState = 'checking' | 'unsupported-browser' | 'not-installed' | 'supported';

export default function PushNotificationCard() {
  const utils = trpc.useUtils();
  const [support, setSupport] = useState<SupportState>('checking');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const { data: publicKeyData } = trpc.push.getPublicKey.useQuery();
  const { data: mySubs = [], refetch: refetchSubs } = trpc.push.listMine.useQuery();
  const subscribeMutation = trpc.push.subscribe.useMutation();
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation();
  const sendTestMutation = trpc.push.sendTest.useMutation();

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setSupport('unsupported-browser');
      return;
    }
    setPermission(Notification.permission);
    // iOS는 홈 화면에 설치된 standalone 상태에서만 푸시가 동작함
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS && !isStandalone) {
      setSupport('not-installed');
      return;
    }
    setSupport('supported');
  }, []);

  const isDeviceSubscribed = async (): Promise<boolean> => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  };

  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  useEffect(() => {
    if (support !== 'supported') return;
    isDeviceSubscribed().then(setDeviceSubscribed);
  }, [support]);

  const handleEnable = async () => {
    if (!publicKeyData?.publicKey) {
      toast.error('서버에 VAPID 키가 설정되어 있지 않습니다.');
      return;
    }
    setIsSubscribing(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        toast.error('알림 권한이 거부되었습니다.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKeyData.publicKey) as BufferSource,
        });
      }
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('구독 정보가 올바르지 않습니다.');
      }
      await subscribeMutation.mutateAsync({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      });
      setDeviceSubscribed(true);
      await refetchSubs();
      toast.success('알림이 켜졌습니다.');
    } catch (err) {
      console.error(err);
      toast.error('알림 켜기에 실패했습니다.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDisable = async () => {
    setIsSubscribing(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribeMutation.mutateAsync({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setDeviceSubscribed(false);
      await refetchSubs();
      toast.success('알림이 꺼졌습니다.');
    } catch {
      toast.error('알림 끄기에 실패했습니다.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    try {
      const result = await sendTestMutation.mutateAsync();
      if (result.total === 0) {
        toast.error('켜진 알림 기기가 없습니다. 먼저 알림을 켜주세요.');
      } else {
        toast.success(`테스트 알림을 보냈습니다 (${result.sent}/${result.total}대).`);
      }
      await utils.push.listMine.invalidate();
    } catch {
      toast.error('테스트 알림 발송에 실패했습니다.');
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
        <BellRing className="w-4 h-4 text-muted-foreground" />
        푸시 알림
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        이 기기에서 알림을 받도록 설정하고, 테스트 알림으로 정상 작동하는지 확인할 수 있어요.
      </p>

      {support === 'checking' && (
        <p className="text-xs text-muted-foreground">확인 중...</p>
      )}

      {support === 'unsupported-browser' && (
        <p className="text-xs text-muted-foreground">이 브라우저는 푸시 알림을 지원하지 않아요.</p>
      )}

      {support === 'not-installed' && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          iOS에서는 먼저 사파리 공유 버튼 → "홈 화면에 추가"로 앱을 설치한 뒤, 그 아이콘으로 열어야 알림을 켤 수 있어요.
        </p>
      )}

      {support === 'supported' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {deviceSubscribed ? (
              <Button variant="outline" size="sm" onClick={handleDisable} disabled={isSubscribing} className="gap-1.5">
                {isSubscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellOff className="w-3.5 h-3.5" />}
                이 기기 알림 끄기
              </Button>
            ) : (
              <Button size="sm" onClick={handleEnable} disabled={isSubscribing} className="gap-1.5">
                {isSubscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                이 기기 알림 켜기
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSendTest} disabled={isSendingTest} className="gap-1.5">
              {isSendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              테스트 알림 보내기
            </Button>
          </div>
          {permission === 'denied' && (
            <p className="text-xs text-destructive">브라우저 알림 권한이 차단되어 있어요. 브라우저/기기 설정에서 이 사이트의 알림 권한을 허용해주세요.</p>
          )}
          <p className="text-xs text-muted-foreground">
            현재 알림을 받도록 등록된 기기: {mySubs.length}대
          </p>
        </div>
      )}
    </div>
  );
}
