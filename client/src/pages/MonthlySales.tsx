import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ChevronLeft, ChevronRight, CalendarDays, Pencil, Loader2, Save } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ko } from 'date-fns/locale';

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원';
}

function typeLabel(type: string) {
  return type === 'translation' ? '번역' : '관리';
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateStr(str: string): Date | undefined {
  if (!str) return undefined;
  const parts = str.split(/[-.]/).map(Number);
  if (parts.length < 3) return undefined;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return isNaN(d.getTime()) ? undefined : d;
}

function formatDateForDisplay(str: string): string {
  if (!str) return '';
  const parts = str.split('-');
  if (parts.length === 3) return `${parts[0]}.${parts[1]}.${parts[2]}`;
  return str;
}

/** 현금영수증 슬라이드 토글 + 날짜 컴포넌트 */
function CashReceiptToggle({
  issued,
  date,
  onToggle,
  onDateChange,
}: {
  issued: boolean;
  date: string | null;
  onToggle: (issued: boolean, date: string | null) => void;
  onDateChange: (date: string) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [inputVal, setInputVal] = useState(date ?? todayStr());
  // 날짜가 이미 저장된 경우 뷰 모드, 아니면 편집 모드
  const [isEditing, setIsEditing] = useState(!issued || !date);

  // 서버에서 date가 바뀌면 동기화
  useEffect(() => {
    if (date) {
      setInputVal(date);
      setIsEditing(false);
    }
  }, [date]);

  const handleToggle = (checked: boolean) => {
    if (checked) {
      const d = inputVal || todayStr();
      onToggle(true, d);
      setIsEditing(true);
    } else {
      onToggle(false, null);
      setIsEditing(false);
    }
  };

  const saveDate = (val: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      onDateChange(val);
      setIsEditing(false);
    }
  };

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    // 숫자만 입력 시 자동으로 대시 삽입
    let formatted = raw;
    if (raw.length >= 5) formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    if (raw.length >= 7) formatted = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    setInputVal(formatted);
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      // 완성된 날짜면 바로 저장
      onDateChange(formatted);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') saveDate(inputVal);
  };

  const handleBlur = () => {
    saveDate(inputVal);
  };

  const handleCalendarSelect = (d: Date | undefined) => {
    if (!d) return;
    const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setInputVal(str);
    onDateChange(str);
    setIsEditing(false);
    setCalendarOpen(false);
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <Switch
        checked={issued}
        onCheckedChange={handleToggle}
        className="data-[state=checked]:bg-emerald-500"
      />
      {/* 고정 너비 + 우측 정렬: th와 날짜 끝 위치 일치 */}
      <div className="w-28 flex items-center justify-end">
        {issued ? (
          isEditing ? (
            /* 편집 모드: 입력 + 달력 */
            <div className="flex items-center gap-1">
              <Input
                type="text"
                value={inputVal}
                onChange={handleDateInput}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder="YYYY-MM-DD"
                className="h-6 text-xs w-24 py-0 px-1.5"
                autoFocus
              />
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={parseDateStr(inputVal)}
                    onSelect={handleCalendarSelect}
                    locale={ko}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            /* 뷰 모드: 연필 + 날짜 텍스트 (날짜가 우측 끝에 오도록) */
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <span className="text-xs text-foreground font-medium tabular-nums">{formatDateForDisplay(inputVal)}</span>
            </div>
          )
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </div>
    </div>
  );
}

/** 업체별 메모 인라인 편집 셀 */
function MemoCell({
  memo,
  isEditing,
  draft,
  isSaving,
  onStartEdit,
  onDraftChange,
  onSave,
  onCancel,
}: {
  memo: string | null;
  isEditing: boolean;
  draft: string;
  isSaving: boolean;
  onStartEdit: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (isEditing) {
    return (
      <div className="space-y-1.5 w-[200px]">
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          rows={2}
          autoFocus
          className="w-full text-xs bg-background border border-input rounded-md px-2 py-1 resize-none break-words focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="메모를 입력하세요"
        />
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={onCancel} disabled={isSaving}>
            취소
          </Button>
          <Button size="sm" className="h-6 text-xs px-2 gap-1" disabled={isSaving} onClick={onSave}>
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            저장
          </Button>
        </div>
      </div>
    );
  }
  return (
    <button type="button" className="w-[200px] text-left group/memo" onClick={onStartEdit}>
      {memo ? (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words group-hover/memo:text-foreground transition-colors">{memo}</p>
      ) : (
        <p className="text-xs text-muted-foreground/40 italic group-hover/memo:text-muted-foreground transition-colors">메모 추가...</p>
      )}
    </button>
  );
}

export default function MonthlySales() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const utils = trpc.useUtils();

  const handlePrevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1); }
    else setSelectedMonth(selectedMonth - 1);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1); }
    else setSelectedMonth(selectedMonth + 1);
  };

  const { data, isLoading } = trpc.sales.getMonthly.useQuery({ year: selectedYear, month: selectedMonth });

  const payments = data?.payments ?? [];
  const hktbInvoices = data?.hktbInvoices ?? [];
  const finalPayments = data?.finalPayments ?? [];

  const paymentTotal = payments.reduce((s, p) => s + p.amount, 0);
  const hktbTotal = hktbInvoices.reduce((s, h) => s + h.totalAmount, 0);
  const finalPaymentTotal = finalPayments.reduce((s, f) => s + (f.finalPaymentAmount ?? f.contractAmount ?? 0), 0);
  const grandTotal = paymentTotal + hktbTotal + finalPaymentTotal;

  // 현금영수증 발급일이 결제일과 다른 달일 수 있어서, 결제 목록이 아니라 서버에서 발급일 기준으로 따로 집계한 값을 사용
  const cashReceiptTotal = data?.cashReceiptTotal ?? 0;
  const cashReceiptCount = data?.cashReceiptCount ?? 0;

  const monthString = `${selectedYear}년 ${selectedMonth}월`;

  const updatePaymentCashReceipt = trpc.sales.updatePaymentCashReceipt.useMutation({
    onSuccess: () => utils.sales.getMonthly.invalidate(),
  });
  const updateHktbCashReceipt = trpc.sales.updateHktbCashReceipt.useMutation({
    onSuccess: () => utils.sales.getMonthly.invalidate(),
  });
  const updateFinalCashReceipt = trpc.sales.updateFinalCashReceipt.useMutation({
    onSuccess: () => utils.sales.getMonthly.invalidate(),
  });

  // 업체별 메모 인라인 편집
  const [editingMemo, setEditingMemo] = useState<{ kind: 'payment' | 'hktb' | 'final'; id: number } | null>(null);
  const [memoDraft, setMemoDraft] = useState('');
  const updatePaymentMemo = trpc.sales.updatePaymentMemo.useMutation({
    onSuccess: () => utils.sales.getMonthly.invalidate(),
  });
  const updateHktbMemo = trpc.sales.updateHktbMemo.useMutation({
    onSuccess: () => utils.sales.getMonthly.invalidate(),
  });
  const updateFinalMemo = trpc.sales.updateFinalMemo.useMutation({
    onSuccess: () => utils.sales.getMonthly.invalidate(),
  });
  const isSavingMemo = updatePaymentMemo.isPending || updateHktbMemo.isPending || updateFinalMemo.isPending;

  const openMemoEditor = (kind: 'payment' | 'hktb' | 'final', id: number, currentMemo: string | null) => {
    setEditingMemo({ kind, id });
    setMemoDraft(currentMemo ?? '');
  };

  const handleSaveMemo = async () => {
    if (!editingMemo) return;
    const { kind, id } = editingMemo;
    if (kind === 'payment') await updatePaymentMemo.mutateAsync({ id, memo: memoDraft });
    else if (kind === 'hktb') await updateHktbMemo.mutateAsync({ id, memo: memoDraft });
    else await updateFinalMemo.mutateAsync({ id, memo: memoDraft });
    setEditingMemo(null);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">월별 매출</h1>
        <p className="text-sm text-muted-foreground mt-1">월별 매출 현황을 조회할 수 있습니다.</p>
      </div>

      {/* Month Selector */}
      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handlePrevMonth} className="gap-1">
            <ChevronLeft className="w-4 h-4" />
            이전
          </Button>
          <h2 className="text-xl font-bold text-foreground">{monthString}</h2>
          <Button variant="outline" size="sm" onClick={handleNextMonth} className="gap-1">
            다음
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-5">
          <div className="text-xs font-medium text-muted-foreground mb-1">총 매출</div>
          <div className="text-2xl font-bold text-foreground">{fmt(grandTotal)}</div>
          <p className="text-xs text-muted-foreground mt-1">{payments.length + hktbInvoices.length + finalPayments.length}건</p>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium text-muted-foreground mb-1">일반 결제</div>
          <div className="text-2xl font-bold text-foreground">{fmt(paymentTotal)}</div>
          <p className="text-xs text-muted-foreground mt-1">{payments.length}건</p>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium text-muted-foreground mb-1">HKTB 인보이스</div>
          <div className="text-2xl font-bold text-foreground">{fmt(hktbTotal)}</div>
          <p className="text-xs text-muted-foreground mt-1">{hktbInvoices.length}건</p>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium text-muted-foreground mb-1">잔금 수령</div>
          <div className="text-2xl font-bold text-foreground">{fmt(finalPaymentTotal)}</div>
          <p className="text-xs text-muted-foreground mt-1">{finalPayments.length}건</p>
        </Card>
        <Card className="p-5 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">현금영수증 발급분</div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{fmt(cashReceiptTotal)}</div>
          <p className="text-xs text-muted-foreground mt-1">{cashReceiptCount}건</p>
        </Card>
      </div>

      {/* HKTB Invoices */}
      {hktbInvoices.length > 0 && (
        <Card className="p-5 mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">HKTB 인보이스</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">종류</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Invoice No.</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">인보이스 날짜</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">금액 (VAT 포함)</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">현금영수증 / 날짜</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">메모</th>
              </tr>
            </thead>
            <tbody>
              {hktbInvoices.map(inv => (
                <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                      {typeLabel(inv.type)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs">{inv.invoiceNo}</td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{inv.invoiceDate}</td>
                  <td className="py-2.5 px-3 text-right font-semibold">{fmt(inv.totalAmount)}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex justify-end">
                      <CashReceiptToggle
                        issued={inv.cashReceiptIssued}
                        date={inv.cashReceiptDate ?? null}
                        onToggle={(issued, date) => updateHktbCashReceipt.mutate({ id: inv.id, issued, date })}
                        onDateChange={(date) => updateHktbCashReceipt.mutate({ id: inv.id, issued: true, date })}
                      />
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <MemoCell
                      memo={inv.memo ?? null}
                      isEditing={editingMemo?.kind === 'hktb' && editingMemo.id === inv.id}
                      draft={memoDraft}
                      isSaving={isSavingMemo}
                      onStartEdit={() => openMemoEditor('hktb', inv.id, inv.memo ?? null)}
                      onDraftChange={setMemoDraft}
                      onSave={handleSaveMemo}
                      onCancel={() => setEditingMemo(null)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Final payments */}
      {finalPayments.length > 0 && (
        <Card className="p-5 mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">잔금 수령</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">수령일</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">고객사</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">담당자</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">잔금</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">현금영수증 / 날짜</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">메모</th>
              </tr>
            </thead>
            <tbody>
              {finalPayments.map(f => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{f.finalPaymentDate}</td>
                  <td className="py-2.5 px-3 text-xs font-medium">{f.name}</td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{f.contactName || '-'}</td>
                  <td className="py-2.5 px-3 text-right font-semibold">
                    {fmt(f.finalPaymentAmount ?? f.contractAmount ?? 0)}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex justify-end">
                      <CashReceiptToggle
                        issued={f.cashReceiptIssued}
                        date={f.cashReceiptDate ?? null}
                        onToggle={(issued, date) => updateFinalCashReceipt.mutate({ id: f.id, issued, date })}
                        onDateChange={(date) => updateFinalCashReceipt.mutate({ id: f.id, issued: true, date })}
                      />
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <MemoCell
                      memo={f.memo ?? null}
                      isEditing={editingMemo?.kind === 'final' && editingMemo.id === f.id}
                      draft={memoDraft}
                      isSaving={isSavingMemo}
                      onStartEdit={() => openMemoEditor('final', f.id, f.memo ?? null)}
                      onDraftChange={setMemoDraft}
                      onSave={handleSaveMemo}
                      onCancel={() => setEditingMemo(null)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* General payments */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">일반 매출 내역</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">날짜</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">고객사</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">프로젝트</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">구분</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">금액</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">현금영수증</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">메모</th>
            </tr>
          </thead>
          <tbody>
            {payments.length > 0 ? payments.map((p) => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 text-xs text-muted-foreground">{p.paymentDate}</td>
                <td className="py-2.5 px-3 text-xs">{p.clientName}</td>
                <td className="py-2.5 px-3 text-xs text-muted-foreground">{p.documentTitle}</td>
                <td className="py-2.5 px-3">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${p.type === 'deposit' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {p.type === 'deposit' ? '계약금' : '잔금'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-semibold">{fmt(p.amount)}</td>
                <td className="py-2.5 px-3">
                  <div className="flex justify-end">
                    <CashReceiptToggle
                      issued={p.cashReceiptIssued}
                      date={p.cashReceiptDate ?? null}
                      onToggle={(issued, date) => updatePaymentCashReceipt.mutate({ id: p.id, issued, date })}
                      onDateChange={(date) => updatePaymentCashReceipt.mutate({ id: p.id, issued: true, date })}
                    />
                  </div>
                </td>
                <td className="py-2.5 px-3">
                  <MemoCell
                    memo={p.memo ?? null}
                    isEditing={editingMemo?.kind === 'payment' && editingMemo.id === p.id}
                    draft={memoDraft}
                    isSaving={isSavingMemo}
                    onStartEdit={() => openMemoEditor('payment', p.id, p.memo ?? null)}
                    onDraftChange={setMemoDraft}
                    onSave={handleSaveMemo}
                    onCancel={() => setEditingMemo(null)}
                  />
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="py-8 px-3 text-center text-xs text-muted-foreground">
                  {monthString}의 일반 매출 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
        </>
      )}
    </div>
  );
}
