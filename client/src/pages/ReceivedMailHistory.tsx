import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Trash2, ChevronLeft, ChevronRight, Loader2, ExternalLink } from 'lucide-react';
import { buildGmailMessageUrl } from '@/lib/utils';

const PAGE_SIZE = 20;
const GMAIL_USER = 'dalbit.work@gmail.com';

function formatReceivedAt(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ReceivedMailHistory() {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.gmail.listAllReceivedMail.useQuery({ page, pageSize: PAGE_SIZE });
  const deleteMutation = trpc.gmail.deleteReceivedMail.useMutation();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleDelete = async (id: number, subject: string) => {
    if (!confirm(`"${subject}" 기록을 삭제하시겠습니까?`)) return;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync({ id });
      await utils.gmail.listAllReceivedMail.invalidate();
      await utils.gmail.listReceivedMail.invalidate();
      toast.success('삭제됐습니다.');
    } catch (err) {
      console.error('[받은메일 삭제 실패]', err);
      toast.error(`삭제에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Mail className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">받은 메일 전체 이력</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? '불러오는 중...' : `총 ${total}개`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="border border-border rounded-lg overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/6" />
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/6 ml-auto" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-lg">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-muted-foreground">받은 메일 기록이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-sm min-w-[720px]">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[20%]" />
                <col className="w-[35%]" />
                <col className="w-[10%]" />
                <col className="w-[20%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">No.</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">고객사/발신자</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">제목</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">상태</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">받은 시간</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">작업</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m, idx) => {
                  const rowNumber = (page - 1) * PAGE_SIZE + idx + 1;
                  const gmailUrl = buildGmailMessageUrl(m.messageId, GMAIL_USER);
                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-border last:border-0 hover:bg-accent/30 transition-colors ${idx % 2 !== 0 ? 'bg-muted/10' : ''}`}
                    >
                      <td className="px-3 py-3 text-left text-muted-foreground">{rowNumber}</td>
                      <td className="px-3 py-3 max-w-0 text-left">
                        <span className="font-medium text-foreground truncate block">{m.clientName || m.fromAddress}</span>
                      </td>
                      <td className="px-4 py-3 max-w-0 text-left">
                        <span className="text-muted-foreground truncate block">{m.subject}</span>
                      </td>
                      <td className="px-3 py-3 text-left">
                        {m.confirmedAt ? (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">확인됨</span>
                        ) : (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">미확인</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-left">
                        <span className="text-muted-foreground">{formatReceivedAt(String(m.notifiedAt))}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {gmailUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8 text-muted-foreground hover:text-foreground"
                              onClick={() => window.open(gmailUrl, '_blank', 'noreferrer')}
                              title="Gmail에서 메일 보기"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(m.id, m.subject)}
                            disabled={deletingId === m.id}
                          >
                            {deletingId === m.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}개
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(p)}
                  className="h-8 w-8 p-0 text-xs"
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
