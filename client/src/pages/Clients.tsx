import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Edit, Trash2, Plus, Save, X, Loader2, Phone, User, CalendarDays, CircleDollarSign, Search, FileText, Hash } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatPhone } from '@/lib/utils';

interface ClientForm {
  name: string;
  contactName: string;
  contactPhone: string;
  businessNumber: string;
  contractDate: string;
  contractAmount: string;
  memo: string;
}

const emptyForm: ClientForm = { name: '', contactName: '', contactPhone: '', businessNumber: '', contractDate: '', contractAmount: '', memo: '' };

type WorkflowStatus = '상담' | '진행대기' | '작업진행중' | 'PC검수' | '모바일작업중' | '고객전달' | '완료';

const WORKFLOW_BADGE: Record<Exclude<WorkflowStatus, '상담'>, { label: string; cls: string }> = {
  '진행대기':   { label: '진행 대기',   cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400' },
  '작업진행중': { label: '작업 진행중', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  'PC검수':     { label: 'PC 검수',    cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
  '모바일작업중': { label: '모바일 작업중', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' },
  '고객전달':   { label: '고객 전달',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  '완료':       { label: '완료',       cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
};

function WorkflowBadge({ workflowStatus, isWorking }: { workflowStatus: string; isWorking: boolean }) {
  const effective = (isWorking && workflowStatus === '상담') ? '진행대기' : workflowStatus;
  if (effective === '상담') return null;
  const badge = WORKFLOW_BADGE[effective as Exclude<WorkflowStatus, '상담'>];
  if (!badge) return null;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-700/60 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function Clients() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const { data: clients = [], isLoading, refetch } = trpc.clients.list.useQuery(
    search ? { search } : undefined
  );
  const { data: allProposals = [] } = trpc.documents.list.useQuery({ type: 'proposal' });
  const { data: allEstimates = [] } = trpc.documents.list.useQuery({ type: 'estimate' });

  const proposalsByClient = allProposals.reduce<Record<string, typeof allProposals>>((acc, doc) => {
    if (!doc.clientName) return acc;
    (acc[doc.clientName] ??= []).push(doc);
    return acc;
  }, {});
  const estimatesByClient = allEstimates.reduce<Record<string, typeof allEstimates>>((acc, doc) => {
    if (!doc.clientName) return acc;
    (acc[doc.clientName] ??= []).push(doc);
    return acc;
  }, {});
  const createMutation = trpc.clients.create.useMutation();
  const updateMutation = trpc.clients.update.useMutation();
  const deleteMutation = trpc.clients.delete.useMutation();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [calendarMonth, setCalendarMonth] = useState<Date | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const parseDateString = (str: string): Date | undefined => {
    const parts = str.split('.');
    if (parts.length === 3 && parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  };
  const [isSaving, setIsSaving] = useState(false);

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const handleEdit = (client: typeof clients[0]) => {
    setEditingId(client.id);
    setForm({
      name: client.name,
      contactName: client.contactName,
      contactPhone: client.contactPhone,
      businessNumber: client.businessNumber,
      contractDate: client.contractDate,
      contractAmount: client.contractAmount ? client.contractAmount.toLocaleString('ko-KR') : '',
      memo: client.memo,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('고객사명을 입력해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...form,
        contractAmount: form.contractAmount ? Number(form.contractAmount.replace(/,/g, '')) : 0,
      };
      if (editingId !== null) {
        await updateMutation.mutateAsync({ id: editingId, ...payload });
        toast.success('고객사가 수정되었습니다.');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('고객사가 등록되었습니다.');
      }
      await refetch();
      handleCancel();
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 고객사를 삭제하시겠습니까?')) return;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync({ id });
      await refetch();
      toast.success('삭제되었습니다.');
    } catch {
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">고객사 관리</h1>
            <p className="text-sm text-muted-foreground mt-1">
              고객사를 등록해두면 견적서 작성 시 자동으로 불러옵니다.
            </p>
          </div>
        </div>
        <Button onClick={handleNew} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          고객사 추가
        </Button>
      </div>

      {/* 검색 */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="고객사명, 담당자, 연락처로 검색..."
          className="pl-9"
        />
      </div>

      {/* 등록/수정 폼 */}
      {showForm && (
        <div className="mb-6 p-4 border border-border rounded-lg bg-card space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {editingId !== null ? '고객사 수정' : '새 고객사 등록'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">고객사명 *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="예: 주식회사 달빛워크"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">담당자 이름</label>
              <Input
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                placeholder="예: 홍길동"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">연락처</label>
              <Input
                value={form.contactPhone}
                onChange={(e) => setForm((f) => ({ ...f, contactPhone: formatPhone(e.target.value) }))}
                placeholder="예: 010-1234-5678"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">사업자번호</label>
              <Input
                value={form.businessNumber}
                onChange={(e) => setForm((f) => ({ ...f, businessNumber: e.target.value }))}
                placeholder="예: 123-45-67890"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">계약일자</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={form.contractDate}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                    let formatted = digits;
                    if (digits.length > 4) formatted = digits.slice(0, 4) + '.' + digits.slice(4);
                    if (digits.length > 6) formatted = digits.slice(0, 4) + '.' + digits.slice(4, 6) + '.' + digits.slice(6);
                    setForm((f) => ({ ...f, contractDate: formatted }));
                    const d = parseDateString(formatted);
                    if (d) setCalendarMonth(d);
                  }}
                  placeholder="예: 2025.01.15"
                  maxLength={10}
                  className="flex-1"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="h-9 w-9 flex items-center justify-center rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0">
                      <CalendarDays className="w-4 h-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      locale={ko}
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      selected={parseDateString(form.contractDate)}
                      onSelect={(date) => {
                        if (!date) return;
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        setForm((f) => ({ ...f, contractDate: `${y}.${m}.${d}` }));
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">계약금액 (원)</label>
              <Input
                value={form.contractAmount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setForm((f) => ({ ...f, contractAmount: raw ? Number(raw).toLocaleString('ko-KR') : '' }));
                }}
                placeholder="예: 2,500,000"
                className="text-right"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">메모</label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
              rows={4}
              className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              placeholder="특이사항, 주의사항 등"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleCancel} className="gap-1">
              <X className="w-3.5 h-3.5" /> 취소
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              저장
            </Button>
          </div>
        </div>
      )}

      {/* 고객사 목록 */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 border border-border rounded-lg animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-4 bg-muted rounded w-10" />
              </div>
              <div className="flex gap-3">
                <div className="h-3 bg-muted rounded w-20" />
                <div className="h-3 bg-muted rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-muted-foreground text-sm">등록된 고객사가 없습니다.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">위 버튼으로 고객사를 추가해보세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map((client) => (
            <div
              key={client.id}
              onClick={() => navigate(`/clients/${client.id}`)}
              className="group flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/40 transition-colors cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-foreground"><Highlight text={client.name} query={search} /></p>
                  {client.status === '완료' ? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                      완료
                    </span>
                  ) : client.status === '계약' ? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                      계약
                    </span>
                  ) : client.status === '제안서' ? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                      제안서
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      상담
                    </span>
                  )}
                  <WorkflowBadge workflowStatus={(client as any).workflowStatus ?? '상담'} isWorking={(client as any).isWorking ?? false} />
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  {client.contactName && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <Highlight text={client.contactName} query={search} />
                    </span>
                  )}
                  {client.contactPhone && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <Highlight text={client.contactPhone} query={search} />
                    </span>
                  )}
                  {client.contractDate && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="w-3 h-3" />
                      {client.contractDate}
                    </span>
                  )}
                  {client.contractAmount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
                      <CircleDollarSign className="w-3 h-3 text-muted-foreground" />
                      {client.contractAmount.toLocaleString('ko-KR')}원
                    </span>
                  )}
                  {client.businessNumber && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Hash className="w-3 h-3" />
                      <Highlight text={client.businessNumber} query={search} />
                    </span>
                  )}
                </div>
                {(proposalsByClient[client.name]?.length > 0 || estimatesByClient[client.name]?.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {proposalsByClient[client.name]?.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={(e) => { e.stopPropagation(); navigate(`/proposals/${doc.id}`); }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                      >
                        <FileText className="w-2.5 h-2.5" />
                        {doc.title || doc.projectName || '제안서'}
                      </button>
                    ))}
                    {estimatesByClient[client.name]?.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={(e) => { e.stopPropagation(); navigate(`/estimates/${doc.id}`); }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
                      >
                        <FileText className="w-2.5 h-2.5" />
                        {doc.title || doc.projectName || '계약서'}
                      </button>
                    ))}
                  </div>
                )}
                {client.memo && (
                  <p className="text-xs text-muted-foreground/70 mt-1 truncate">{client.memo}</p>
                )}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(client); }} className="w-7 h-7 p-0">
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }}
                  disabled={deletingId === client.id}
                  className="w-7 h-7 p-0 text-destructive hover:text-destructive"
                >
                  {deletingId === client.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
