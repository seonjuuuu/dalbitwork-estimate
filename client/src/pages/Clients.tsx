import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Edit, Trash2, Plus, Save, X, Loader2, CalendarDays, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const PAGE_SIZE = 10;

type WorkflowStatus = '상담' | '진행대기' | '작업진행중' | 'PC검수' | '모바일작업중' | '고객전달' | '완료';

const WORKFLOW_BADGE: Record<Exclude<WorkflowStatus, '상담'>, { label: string; cls: string }> = {
  '진행대기':   { label: '진행 대기',   cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400' },
  '작업진행중': { label: '작업 진행중', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  'PC검수':     { label: 'PC 검수',    cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
  '모바일작업중': { label: '모바일 작업중', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' },
  '고객전달':   { label: '고객 전달',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  '완료':       { label: '완료',       cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
};

const WORKFLOW_OPTIONS: { key: WorkflowStatus; label: string; cls: string }[] = [
  { key: '상담',       label: '상담',       cls: 'bg-muted text-muted-foreground' },
  { key: '진행대기',   label: '진행 대기',   cls: WORKFLOW_BADGE['진행대기'].cls },
  { key: '작업진행중', label: '작업 진행중', cls: WORKFLOW_BADGE['작업진행중'].cls },
  { key: 'PC검수',     label: 'PC 검수',    cls: WORKFLOW_BADGE['PC검수'].cls },
  { key: '모바일작업중', label: '모바일 작업중', cls: WORKFLOW_BADGE['모바일작업중'].cls },
  { key: '고객전달',   label: '고객 전달',  cls: WORKFLOW_BADGE['고객전달'].cls },
  { key: '완료',       label: '완료',       cls: WORKFLOW_BADGE['완료'].cls },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  '완료':   { label: '완료',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  '계약':   { label: '계약',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  '제안서': { label: '제안서', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  '상담':   { label: '상담',   cls: 'bg-muted text-muted-foreground' },
};

const STATUS_OPTIONS: { key: string; label: string; cls: string }[] = [
  { key: '상담',   label: '상담',   cls: STATUS_BADGE['상담'].cls },
  { key: '제안서', label: '제안서', cls: STATUS_BADGE['제안서'].cls },
  { key: '계약',   label: '계약',   cls: STATUS_BADGE['계약'].cls },
  { key: '완료',   label: '완료',   cls: STATUS_BADGE['완료'].cls },
];

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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const { data: clients = [], isLoading, refetch } = trpc.clients.list.useQuery(
    debouncedSearch ? { search: debouncedSearch } : undefined
  );
  const createMutation = trpc.clients.create.useMutation();
  const updateMutation = trpc.clients.update.useMutation();
  const deleteMutation = trpc.clients.delete.useMutation();
  const updateWorkflowMutation = trpc.kanban.updateStatus.useMutation();
  const [updatingWorkflowId, setUpdatingWorkflowId] = useState<number | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  const handleWorkflowChange = async (clientId: number, workflowStatus: string) => {
    setUpdatingWorkflowId(clientId);
    try {
      await updateWorkflowMutation.mutateAsync({ id: clientId, workflowStatus: workflowStatus as any });
      await refetch();
    } catch {
      toast.error('진행 현황 변경에 실패했습니다.');
    } finally {
      setUpdatingWorkflowId(null);
    }
  };

  const handleStatusChange = async (clientId: number, status: string) => {
    setUpdatingStatusId(clientId);
    try {
      await updateMutation.mutateAsync({ id: clientId, status: status as any });
      await refetch();
    } catch {
      toast.error('상태 변경에 실패했습니다.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [workflowFilter, setWorkflowFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

  const displayedClients = clients.filter((c) => {
    const ws = (c as any).workflowStatus ?? '상담';
    const matchStatus = statusFilter ? c.status === statusFilter : true;
    const matchWorkflow = workflowFilter ? ws === workflowFilter : true;

    // 진행현황 필터를 따로 안 걸었고 검색 중도 아니면, 완료된 지 한 달 지난 건은 기본 목록에서 숨김
    if (!workflowFilter && !search && ws === '완료') {
      const completedAt = (c as any).workflowCompletedAt;
      if (completedAt && Date.now() - new Date(completedAt).getTime() > ONE_MONTH_MS) {
        return false;
      }
    }

    return matchStatus && matchWorkflow;
  });

  const totalPages = Math.max(1, Math.ceil(displayedClients.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedClients = displayedClients.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
    <div className="max-w-6xl mx-auto p-6">
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

      {/* 검색 & 필터 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-5">
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="고객사명, 담당자, 연락처로 검색..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">고객 상태</span>
          <Select
            value={statusFilter ?? 'all'}
            onValueChange={(v) => { setStatusFilter(v === 'all' ? null : v); setCurrentPage(1); }}
          >
            <SelectTrigger size="sm" className="w-full sm:w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="상담">상담</SelectItem>
              <SelectItem value="제안서">제안서</SelectItem>
              <SelectItem value="계약">계약</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">진행 현황</span>
          <Select
            value={workflowFilter ?? 'all'}
            onValueChange={(v) => { setWorkflowFilter(v === 'all' ? null : v); setCurrentPage(1); }}
          >
            <SelectTrigger size="sm" className="w-full sm:w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="진행대기">진행 대기</SelectItem>
              <SelectItem value="작업진행중">작업 진행중</SelectItem>
              <SelectItem value="PC검수">PC 검수</SelectItem>
              <SelectItem value="모바일작업중">모바일 작업중</SelectItem>
              <SelectItem value="고객전달">고객 전달</SelectItem>
              <SelectItem value="완료">완료</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(statusFilter !== null || workflowFilter !== null) && (
          <button
            onClick={() => { setStatusFilter(null); setWorkflowFilter(null); setCurrentPage(1); }}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1.5 bg-background hover:bg-muted transition-colors"
          >
            초기화
          </button>
        )}
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
        <div className="border border-border rounded-lg overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-4 bg-muted rounded w-1/6" />
              <div className="h-4 bg-muted rounded w-1/6" />
              <div className="h-4 bg-muted rounded w-1/6 ml-auto" />
            </div>
          ))}
        </div>
      ) : displayedClients.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-lg">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-muted-foreground text-sm">
            {statusFilter ? `'${statusFilter}' 상태의 고객사가 없습니다.` : '등록된 고객사가 없습니다.'}
          </p>
          {!statusFilter && <p className="text-muted-foreground/60 text-xs mt-1">위 버튼으로 고객사를 추가해보세요.</p>}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[18%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[9%]" />
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">No.</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">고객사명</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">담당자</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">연락처</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">상태</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">진행 현황</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">계약일</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">계약금액</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">작업</th>
              </tr>
            </thead>
            <tbody>
              {pagedClients.map((client, idx) => {
                const rowNumber = (safePage - 1) * PAGE_SIZE + idx + 1;
                return (
                  <tr
                    key={client.id}
                    onClick={() => navigate(`/clients/${client.id}`)}
                    className={`border-b border-border last:border-0 hover:bg-accent/30 transition-colors cursor-pointer ${idx % 2 !== 0 ? 'bg-muted/10' : ''}`}
                  >
                    <td className="px-3 py-3 text-left text-muted-foreground">{rowNumber}</td>
                    <td className="px-4 py-3 max-w-0 text-left">
                      <span className="font-medium text-foreground truncate block"><Highlight text={client.name} query={search} /></span>
                    </td>
                    <td className="px-3 py-3 max-w-0 text-left">
                      <span className="text-muted-foreground truncate block">
                        {client.contactName ? <Highlight text={client.contactName} query={search} /> : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-left">
                      <span className="text-muted-foreground">
                        {client.contactPhone ? <Highlight text={client.contactPhone} query={search} /> : '—'}
                      </span>
                    </td>
                    <td className="px-1 py-2 text-left" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={client.status}
                        onValueChange={(v) => handleStatusChange(client.id, v)}
                        disabled={updatingStatusId === client.id}
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-7 w-full border-none shadow-none bg-transparent hover:bg-muted px-2 gap-1 [&>svg:last-child]:hidden"
                        >
                          {updatingStatusId === client.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(({ key, label, cls }) => (
                            <SelectItem key={key} value={key}>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>
                                {label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-1 py-2 text-left" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={(client as any).workflowStatus ?? '상담'}
                        onValueChange={(v) => handleWorkflowChange(client.id, v)}
                        disabled={updatingWorkflowId === client.id}
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-7 w-full border-none shadow-none bg-transparent hover:bg-muted px-2 gap-1 [&>svg:last-child]:hidden"
                        >
                          {updatingWorkflowId === client.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {WORKFLOW_OPTIONS.map(({ key, label, cls }) => (
                            <SelectItem key={key} value={key}>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>
                                {label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-left">
                      <span className="text-muted-foreground">{client.contractDate || '—'}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-left">
                      <span className="text-foreground/80">
                        {client.contractAmount > 0 ? `${client.contractAmount.toLocaleString('ko-KR')}원` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-start">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(client); }} className="h-7 w-7 p-0">
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }}
                          disabled={deletingId === client.id}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        >
                          {deletingId === client.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이징 */}
      {!isLoading && displayedClients.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, displayedClients.length)} / {displayedClients.length}개
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === safePage ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className="h-8 w-8 p-0 text-xs"
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
