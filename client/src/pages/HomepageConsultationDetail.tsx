import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquareText, Trash2, Loader2, Phone, Building2, Tag, CircleDollarSign, Clock } from 'lucide-react';

function formatReceivedAt(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HomepageConsultationDetail({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: item, isLoading } = trpc.homepageConsultations.get.useQuery({ id: Number(id) });
  const markReadMutation = trpc.homepageConsultations.markRead.useMutation();
  const deleteMutation = trpc.homepageConsultations.delete.useMutation();

  const handleToggleRead = async () => {
    if (!item) return;
    try {
      await markReadMutation.mutateAsync({ id: item.id, isRead: !item.isRead });
      await utils.homepageConsultations.get.invalidate({ id: item.id });
      await utils.homepageConsultations.list.invalidate();
      await utils.homepageConsultations.listUnread.invalidate();
    } catch (err) {
      console.error('[상담폼 읽음 처리 실패]', err);
      toast.error('처리에 실패했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!confirm(`"${item.name}"님의 상담 신청을 삭제하시겠습니까?`)) return;
    try {
      await deleteMutation.mutateAsync({ id: item.id });
      await utils.homepageConsultations.list.invalidate();
      await utils.homepageConsultations.listUnread.invalidate();
      toast.success('삭제됐습니다.');
      navigate('/homepage-consultations');
    } catch (err) {
      console.error('[상담폼 삭제 실패]', err);
      toast.error(`삭제에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center py-16">
        <p className="text-muted-foreground">해당 상담 신청을 찾을 수 없습니다.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/homepage-consultations')}>
          목록으로
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-6 flex-wrap">
        <button
          onClick={() => navigate('/homepage-consultations')}
          className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <MessageSquareText className="w-6 h-6 text-primary flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">{item.name}님의 상담 신청</h1>
          <p className="text-sm text-muted-foreground mt-1">{formatReceivedAt(String(item.createdAt))}</p>
        </div>
        <span
          className={`sm:ml-auto text-xs px-2 py-1 rounded-full flex-shrink-0 ${
            item.isRead ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
          }`}
        >
          {item.isRead ? '읽음' : '안읽음'}
        </span>
      </div>

      <div className="border border-border rounded-lg p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground w-16 flex-shrink-0">연락처</span>
          <a href={`tel:${item.contact}`} className="text-sm text-foreground hover:underline">
            {item.contact}
          </a>
        </div>
        {item.company && (
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground w-16 flex-shrink-0">회사명</span>
            <span className="text-sm text-foreground">{item.company}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Tag className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground w-16 flex-shrink-0">분야</span>
          <span className="text-sm text-foreground">{item.service}</span>
        </div>
        {item.budget && (
          <div className="flex items-center gap-3">
            <CircleDollarSign className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground w-16 flex-shrink-0">예산</span>
            <span className="text-sm text-foreground">{item.budget}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-muted-foreground w-16 flex-shrink-0">신청 시간</span>
          <span className="text-sm text-foreground">{formatReceivedAt(String(item.createdAt))}</span>
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-sm text-muted-foreground mb-2">문의 내용</p>
          <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
            {item.message || '(문의 내용 없음)'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <Button variant="outline" onClick={handleToggleRead}>
          {item.isRead ? '안읽음으로 표시' : '읽음으로 표시'}
        </Button>
        <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleDelete}>
          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
          삭제
        </Button>
      </div>
    </div>
  );
}
