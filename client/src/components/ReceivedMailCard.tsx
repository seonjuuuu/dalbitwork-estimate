import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Mail, Loader2, ExternalLink } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { buildGmailMessageUrl } from '@/lib/utils';

const GMAIL_USER = 'dalbit.work@gmail.com';

function formatReceivedAt(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ReceivedMailCard() {
  const [, navigate] = useLocation();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data: mail = [], isLoading } = trpc.gmail.listReceivedMail.useQuery();
  const confirmMutation = trpc.gmail.confirmReceivedMail.useMutation({
    onSuccess: () => {
      utils.gmail.listReceivedMail.invalidate();
      utils.gmail.listAllReceivedMail.invalidate();
    },
    onSettled: () => setConfirmingId(null),
  });

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          받은 메일
          {mail.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">({mail.length}건)</span>
          )}
        </h2>
        <button
          onClick={() => navigate('/received-mail')}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          더보기
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : mail.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">확인 안 한 고객 메일이 없어요.</p>
      ) : (
        <ul className="space-y-1.5 max-h-72 overflow-y-auto">
          {mail.map((m) => {
            const gmailUrl = buildGmailMessageUrl(m.messageId, GMAIL_USER);
            return (
              <li key={m.id} className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-accent transition-colors">
                {confirmingId === m.id ? (
                  <Loader2 className="w-4 h-4 mt-0.5 flex-shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <Checkbox
                    className="mt-0.5 flex-shrink-0"
                    checked={false}
                    onCheckedChange={() => {
                      setConfirmingId(m.id);
                      confirmMutation.mutate({ id: m.id });
                    }}
                    disabled={confirmMutation.isPending}
                    aria-label="확인 완료"
                  />
                )}
                <button
                  onClick={() => (gmailUrl ? window.open(gmailUrl, '_blank', 'noreferrer') : navigate('/clients'))}
                  className="flex-1 min-w-0 text-left flex items-start justify-between gap-3"
                  title={gmailUrl ? 'Gmail에서 메일 보기' : undefined}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate flex items-center gap-1">
                      {m.clientName || m.fromAddress}
                      {gmailUrl && <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{m.subject}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {formatReceivedAt(String(m.notifiedAt))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
