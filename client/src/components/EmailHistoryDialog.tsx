import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { History, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';

interface EmailHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
}

function formatSentAt(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function EmailHistoryDialog({ isOpen, onClose, clientId }: EmailHistoryDialogProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { data: history = [], refetch } = trpc.clientEmails.listByClient.useQuery(
    { clientId },
    { enabled: isOpen }
  );
  const deleteMutation = trpc.clientEmails.delete.useMutation();

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 발송 이력을 삭제하시겠습니까?')) return;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync({ id });
      await refetch();
      toast.success('삭제했어요.');
    } catch {
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            발송 이력
          </DialogTitle>
          <DialogDescription>이 고객사에게 보낸 이메일·문자 발송 기록이에요. 테스트로 보낸 항목은 삭제할 수 있어요.</DialogDescription>
        </DialogHeader>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">아직 발송 이력이 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="border border-border rounded-lg p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        h.channel === 'sms'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                      }`}
                    >
                      {h.channel === 'sms' ? '문자' : '이메일'}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatSentAt(String(h.sentAt))}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(h.id)}
                    disabled={deletingId === h.id}
                    className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors disabled:opacity-50"
                    title="삭제"
                  >
                    {deletingId === h.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {h.toAddress && <p className="text-xs text-foreground">받는사람: {h.toAddress}</p>}
                {h.subject && <p className="text-sm font-medium text-foreground">{h.subject}</p>}
                <button
                  onClick={() => setExpandedId((prev) => (prev === h.id ? null : h.id))}
                  className="w-full text-left"
                >
                  <p
                    className={`text-xs text-muted-foreground whitespace-pre-wrap ${
                      expandedId === h.id ? '' : 'line-clamp-3'
                    }`}
                  >
                    {h.body}
                  </p>
                  {expandedId !== h.id && (
                    <span className="text-[11px] text-primary hover:underline">더보기</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
