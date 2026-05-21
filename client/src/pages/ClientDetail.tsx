import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ko } from 'date-fns/locale';
import {
  ArrowLeft, Plus, Trash2, Save, X, Loader2,
  Phone, User, CalendarDays, CircleDollarSign,
  MessageSquare, ChevronDown, ChevronUp, Edit, LinkIcon,
} from 'lucide-react';
import { toast } from 'sonner';

interface ConsultationForm {
  date: string;
  content: string;
  nextAction: string;
}

const today = new Date().toISOString().split('T')[0].replace(/-/g, '.');
const emptyForm: ConsultationForm = { date: today, content: '', nextAction: '' };

const STATUSES = ['상담', '제안서', '계약'] as const;
type Status = typeof STATUSES[number];

const STATUS_STYLE: Record<Status, string> = {
  '상담': 'bg-muted text-muted-foreground hover:bg-muted/80',
  '제안서': 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-400',
  '계약': 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-400',
};

export default function ClientDetail({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const clientId = parseInt(id);

  const { data: client, refetch: refetchClient } = trpc.clients.get.useQuery({ id: clientId });
  const { data: consultations = [], refetch } = trpc.consultations.list.useQuery({ clientId });
  const { data: matchedEstimates = [] } = trpc.clients.getMatchedEstimates.useQuery(
    { clientName: client?.name ?? '' },
    { enabled: !!client?.name }
  );
  const updateClientMutation = trpc.clients.update.useMutation();
  const createMutation = trpc.consultations.create.useMutation();
  const updateMutation = trpc.consultations.update.useMutation();
  const deleteMutation = trpc.consultations.delete.useMutation();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ConsultationForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date | undefined>(undefined);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [syncingEstimateId, setSyncingEstimateId] = useState<number | null>(null);

  const parseDateString = (str: string): Date | undefined => {
    const parts = str.split('.');
    if (parts.length === 3 && parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  };

  const handleStatusChange = async (newStatus: Status) => {
    setStatusPopoverOpen(false);
    try {
      await updateClientMutation.mutateAsync({ id: clientId, status: newStatus });
      await refetchClient();
      toast.success(`상태가 "${newStatus}"로 변경되었습니다.`);
    } catch {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  const handleSyncEstimate = async (est: typeof matchedEstimates[0]) => {
    setSyncingEstimateId(est.id);
    try {
      await updateClientMutation.mutateAsync({
        id: clientId,
        contractDate: est.date || '',
        contractAmount: est.totalMin || 0,
      });
      await refetchClient();
      toast.success('계약서 정보가 연동되었습니다.');
    } catch {
      toast.error('연동에 실패했습니다.');
    } finally {
      setSyncingEstimateId(null);
    }
  };

  const handleNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const handleEdit = (c: typeof consultations[0]) => {
    setEditingId(c.id);
    setForm({ date: c.date, content: c.content, nextAction: c.nextAction });
    const d = parseDateString(c.date);
    if (d) setCalendarMonth(d);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.content.trim()) {
      toast.error('상담 내용을 입력해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId !== null) {
        await updateMutation.mutateAsync({ id: editingId, ...form });
        toast.success('수정되었습니다.');
      } else {
        await createMutation.mutateAsync({ clientId, ...form });
        toast.success('상담 이력이 추가되었습니다.');
      }
      await refetch();
      handleCancel();
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (consultId: number) => {
    if (!window.confirm('이 상담 이력을 삭제하시겠습니까?')) return;
    try {
      await deleteMutation.mutateAsync({ id: consultId });
      await refetch();
      toast.success('삭제되었습니다.');
    } catch {
      toast.error('삭제에 실패했습니다.');
    }
  };

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 4) + '.' + digits.slice(4);
    if (digits.length > 6) formatted = digits.slice(0, 4) + '.' + digits.slice(4, 6) + '.' + digits.slice(6);
    setForm((f) => ({ ...f, date: formatted }));
    const d = parseDateString(formatted);
    if (d) setCalendarMonth(d);
  };

  if (!client) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentStatus = (client.status ?? '상담') as Status;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/clients')}
          className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">{client.name}</h1>

            {/* 클릭해서 상태 변경 */}
            <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-colors cursor-pointer ${STATUS_STYLE[currentStatus]}`}
                >
                  {currentStatus}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1" align="start">
                <p className="text-[10px] text-muted-foreground px-2 py-1">상태 변경</p>
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors flex items-center gap-2 ${
                      s === currentStatus ? 'font-semibold bg-accent' : 'hover:bg-accent'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      s === '상담' ? 'bg-muted-foreground' :
                      s === '제안서' ? 'bg-blue-500' : 'bg-amber-500'
                    }`} />
                    {s}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* 고객 기본 정보 */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">기본 정보</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {client.contactName && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{client.contactName}</span>
            </div>
          )}
          {client.contactPhone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{client.contactPhone}</span>
            </div>
          )}
          {client.contractDate && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{client.contractDate}</span>
            </div>
          )}
          {client.contractAmount > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CircleDollarSign className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-semibold text-foreground">{client.contractAmount.toLocaleString('ko-KR')}원</span>
            </div>
          )}
          {client.businessNumber && (
            <div className="col-span-2 text-muted-foreground text-xs">{client.businessNumber}</div>
          )}
        </div>
        {client.memo && (
          <p className="mt-3 text-xs text-muted-foreground/80 border-t border-border pt-3 whitespace-pre-wrap">{client.memo}</p>
        )}
      </div>

      {/* 계약서 연동 */}
      {matchedEstimates.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-muted-foreground" />
            연동 가능한 계약서
            <span className="text-xs text-muted-foreground font-normal">({matchedEstimates.length}건)</span>
          </h2>
          <div className="space-y-2">
            {matchedEstimates.map((est) => (
              <div key={est.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{est.title || '(제목 없음)'}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {est.date && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {est.date}
                      </span>
                    )}
                    {est.totalMin > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CircleDollarSign className="w-3 h-3" />
                        {est.totalMin.toLocaleString('ko-KR')}원
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSyncEstimate(est)}
                  disabled={syncingEstimateId === est.id}
                  className="h-7 text-xs gap-1 flex-shrink-0 ml-3"
                >
                  {syncingEstimateId === est.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <LinkIcon className="w-3 h-3" />}
                  연동
                </Button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-2">연동하면 계약일자와 계약금액이 계약서 정보로 업데이트됩니다.</p>
        </div>
      )}

      {/* 상담 이력 */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            상담 이력
            {consultations.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">({consultations.length}건)</span>
            )}
          </h2>
          <Button size="sm" onClick={handleNew} className="gap-1 h-7 text-xs">
            <Plus className="w-3.5 h-3.5" />
            추가
          </Button>
        </div>

        {/* 추가/수정 폼 */}
        {showForm && (
          <div className="mb-4 p-4 border border-border rounded-lg bg-muted/30 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">상담일자</label>
                <div className="flex gap-1.5">
                  <Input
                    value={form.date}
                    onChange={handleDateInput}
                    placeholder="2025.01.15"
                    maxLength={10}
                    className="h-8 text-sm flex-1"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="h-8 w-8 flex items-center justify-center rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0">
                        <CalendarDays className="w-3.5 h-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        locale={ko}
                        month={calendarMonth}
                        onMonthChange={setCalendarMonth}
                        selected={parseDateString(form.date)}
                        onSelect={(date) => {
                          if (!date) return;
                          const y = date.getFullYear();
                          const m = String(date.getMonth() + 1).padStart(2, '0');
                          const d = String(date.getDate()).padStart(2, '0');
                          setForm((f) => ({ ...f, date: `${y}.${m}.${d}` }));
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">다음 액션</label>
                <Input
                  value={form.nextAction}
                  onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value }))}
                  placeholder="예: 다음주 제안서 전달, 견적 확인 요청..."
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">상담 내용 *</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={4}
                className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 resize-y min-h-[90px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                placeholder="상담 내용을 기록하세요..."
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel} className="gap-1 h-7 text-xs">
                <X className="w-3 h-3" /> 취소
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1 h-7 text-xs">
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                저장
              </Button>
            </div>
          </div>
        )}

        {/* 이력 목록 */}
        {consultations.length === 0 ? (
          <div className="text-center py-10">
            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">아직 상담 이력이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {consultations.map((c) => {
              const isExpanded = expandedId === c.id;
              return (
                <div key={c.id} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">{c.date}</span>
                        {c.nextAction && (
                          <span className="text-xs text-primary truncate">→ {c.nextAction}</span>
                        )}
                      </div>
                      <p className="text-sm text-foreground truncate mt-0.5">{c.content}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/20">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{c.content}</p>
                      {c.nextAction && (
                        <p className="text-xs text-primary mt-2 font-medium">→ 다음 액션: {c.nextAction}</p>
                      )}
                      <div className="flex justify-end gap-1 mt-3">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(c)} className="h-7 text-xs gap-1">
                          <Edit className="w-3 h-3" /> 수정
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="h-7 text-xs gap-1 text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3" /> 삭제
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
