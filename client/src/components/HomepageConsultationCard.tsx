import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { MessageSquareText, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

function formatReceivedAt(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HomepageConsultationCard() {
  const [, navigate] = useLocation();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.homepageConsultations.listUnread.useQuery();
  const markReadMutation = trpc.homepageConsultations.markRead.useMutation({
    onSuccess: () => {
      utils.homepageConsultations.listUnread.invalidate();
      utils.homepageConsultations.list.invalidate();
    },
    onSettled: () => setConfirmingId(null),
  });

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageSquareText className="w-4 h-4 text-muted-foreground" />
          홈페이지 상담폼
          {items.length > 0 && (
            <span className="text-xs text-primary font-semibold">({items.length}건 안읽음)</span>
          )}
        </h2>
        <button
          onClick={() => navigate('/homepage-consultations')}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          더보기
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">새로 들어온 상담 신청이 없어요.</p>
      ) : (
        <ul className="space-y-1.5 max-h-72 overflow-y-auto">
          {items.map(item => (
            <li key={item.id} className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-accent transition-colors">
              {confirmingId === item.id ? (
                <Loader2 className="w-4 h-4 mt-0.5 flex-shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <Checkbox
                  className="mt-0.5 flex-shrink-0"
                  checked={false}
                  onCheckedChange={() => {
                    setConfirmingId(item.id);
                    markReadMutation.mutate({ id: item.id, isRead: true });
                  }}
                  disabled={markReadMutation.isPending}
                  aria-label="읽음 처리"
                />
              )}
              <button
                onClick={() => navigate(`/homepage-consultations/${item.id}`)}
                className="flex-1 min-w-0 text-left flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.name}{item.company ? ` (${item.company})` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{item.contact} · {item.service}</p>
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {formatReceivedAt(String(item.createdAt))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
