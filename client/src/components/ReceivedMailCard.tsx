import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Mail, Loader2 } from 'lucide-react';

function formatReceivedAt(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ReceivedMailCard() {
  const [, navigate] = useLocation();
  const { data: mail = [], isLoading } = trpc.gmail.listReceivedMail.useQuery();

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Mail className="w-4 h-4 text-muted-foreground" />
        받은 메일
        {mail.length > 0 && (
          <span className="text-xs text-muted-foreground font-normal">({mail.length}건)</span>
        )}
      </h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : mail.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">아직 받은 고객 메일이 없어요.</p>
      ) : (
        <ul className="space-y-1.5 max-h-72 overflow-y-auto">
          {mail.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => navigate('/clients')}
                className="w-full text-left flex items-start justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.clientName || m.fromAddress}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.subject}</p>
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {formatReceivedAt(String(m.notifiedAt))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
