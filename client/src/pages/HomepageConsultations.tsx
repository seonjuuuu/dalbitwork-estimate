import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquareText, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

const PAGE_SIZE = 20;

function formatReceivedAt(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HomepageConsultations() {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.homepageConsultations.list.useQuery({ page, pageSize: PAGE_SIZE });
  const { data: unread = [] } = trpc.homepageConsultations.listUnread.useQuery();
  const markReadMutation = trpc.homepageConsultations.markRead.useMutation();
  const deleteMutation = trpc.homepageConsultations.delete.useMutation();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleToggleRead = async (id: number, isRead: boolean) => {
    try {
      await markReadMutation.mutateAsync({ id, isRead: !isRead });
      await utils.homepageConsultations.list.invalidate();
      await utils.homepageConsultations.listUnread.invalidate();
    } catch (err) {
      console.error('[상담폼 읽음 처리 실패]', err);
      toast.error('처리에 실패했습니다.');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}"님의 상담 신청을 삭제하시겠습니까?`)) return;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync({ id });
      await utils.homepageConsultations.list.invalidate();
      await utils.homepageConsultations.listUnread.invalidate();
      toast.success('삭제됐습니다.');
    } catch (err) {
      console.error('[상담폼 삭제 실패]', err);
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
        <MessageSquareText className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">홈페이지 상담폼</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? '불러오는 중...' : `총 ${total}건`}
          </p>
        </div>
        {unread.length > 0 && (
          <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold flex-shrink-0">
            안읽음 {unread.length}건
          </span>
        )}
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
          <MessageSquareText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-muted-foreground">아직 들어온 상담 신청이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-sm min-w-[880px]">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[13%]" />
                <col className="w-[14%]" />
                <col className="w-[9%]" />
                <col className="w-[18%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">No.</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">이름</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">회사명</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">연락처</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">분야</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">상태</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">신청 시간</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">작업</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const rowNumber = (page - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/homepage-consultations/${item.id}`)}
                      className={`cursor-pointer border-b border-border last:border-0 hover:bg-accent/30 transition-colors ${idx % 2 !== 0 ? 'bg-muted/10' : ''} ${!item.isRead ? 'bg-primary/5' : ''}`}
                    >
                      <td className="px-3 py-3 text-left text-muted-foreground">{rowNumber}</td>
                      <td className="px-3 py-3 max-w-0 text-left">
                        <span className="font-medium text-foreground truncate block">{item.name}</span>
                      </td>
                      <td className="px-3 py-3 max-w-0 text-left">
                        <span className="text-muted-foreground truncate block">{item.company || '-'}</span>
                      </td>
                      <td className="px-3 py-3 max-w-0 text-left">
                        <span className="text-muted-foreground truncate block">{item.contact}</span>
                      </td>
                      <td className="px-3 py-3 max-w-0 text-left">
                        <span className="text-muted-foreground truncate block">{item.service}</span>
                      </td>
                      <td className="px-3 py-3 text-left" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleRead(item.id, item.isRead)}
                          className={`text-[11px] px-1.5 py-0.5 rounded-full transition-colors ${
                            item.isRead
                              ? 'bg-muted text-muted-foreground hover:bg-muted/70'
                              : 'bg-primary/10 text-primary hover:bg-primary/20'
                          }`}
                        >
                          {item.isRead ? '읽음' : '안읽음'}
                        </button>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-left">
                        <span className="text-muted-foreground">{formatReceivedAt(String(item.createdAt))}</span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(item.id, item.name)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
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
