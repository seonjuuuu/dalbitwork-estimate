import { useEffect } from 'react';
import { trpc } from '@/lib/trpc';

const POLL_INTERVAL_MS = 90_000;

/**
 * 앱이 열려있는 동안 주기적으로 서버에 "등록된 고객 이메일로 새 메일 왔는지" 확인을 요청한다.
 * Gmail 쪽 실제 조회·판단은 서버(gmailWatcher.ts)에서 처리하고, 여기서는 그 트리거만 담당.
 * Vercel 크론은 하루 1회로 제한적이라 서버 크론 대신 앱이 켜져 있는 세션에서 폴링하는 방식을 씀.
 */
export default function GmailWatcher() {
  const checkMutation = trpc.gmail.checkNewMail.useMutation();

  useEffect(() => {
    checkMutation.mutate();
    const interval = setInterval(() => {
      checkMutation.mutate();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
