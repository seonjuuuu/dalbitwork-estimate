import { useMemo, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Loader2, Megaphone, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Category = 'ad_spend' | 'ai_cost';
type Currency = 'KRW' | 'USD';

const CATEGORY_LABEL: Record<Category, string> = {
  ad_spend: '광고비',
  ai_cost: 'AI 비용',
};

const CATEGORY_STYLE: Record<Category, string> = {
  ad_spend: 'bg-teal-600 text-white border-teal-600',
  ai_cost: 'bg-violet-600 text-white border-violet-600',
};

const CATEGORY_TEXT_CLASS: Record<Category, string> = {
  ad_spend: 'text-teal-700 dark:text-teal-300',
  ai_cost: 'text-violet-700 dark:text-violet-300',
};

const SERIES_TEXT_CLASS: Record<SeriesKey, string> = {
  ad_spend: 'text-teal-700 dark:text-teal-300',
  ai_cost: 'text-violet-700 dark:text-violet-300',
  total: 'text-foreground font-semibold',
};

type ParsedRow = {
  date: string;
  time: string;
  merchant: string;
  amount: number;
  currency: Currency;
  installment: string;
  approvalNo: string;
  suggestedCategory: Category | null;
};

function fmt(amount: number, currency: Currency) {
  if (currency === 'USD') {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return Math.round(amount).toLocaleString('ko-KR') + '원';
}

function monthLabel(month: string) {
  const [y, m] = month.split('-');
  return `${y}년 ${Number(m)}월`;
}

function monthOnlyLabel(month: string) {
  const [, m] = month.split('-');
  return `${Number(m)}월`;
}

function axisAmount(n: number, currency: Currency) {
  if (currency === 'USD') return n === 0 ? '0' : `$${n.toLocaleString('en-US')}`;
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString('ko-KR')}만`;
  return n.toLocaleString('ko-KR');
}

type SeriesKey = Category | 'total';

const SERIES_LABEL: Record<SeriesKey, string> = {
  ad_spend: '광고비',
  ai_cost: 'AI 비용',
  total: '합계',
};

const SERIES_COLOR: Record<SeriesKey, string> = {
  ad_spend: '#0d9488',
  ai_cost: '#7c3aed',
  total: '#64748b',
};

const ALL_SERIES: SeriesKey[] = ['ad_spend', 'ai_cost', 'total'];

type ChartRow = { label: string; ad_spend: number; ai_cost: number; total: number };

/** currency별로 나눠서 [ad_spend, ai_cost, total] 그래프용 데이터로 변환 */
function buildChartsByCurrency(
  rows: { category: Category; currency: Currency; amount: number; groupKey: string }[]
): { currency: Currency; data: ChartRow[] }[] {
  const byCurrency = new Map<Currency, Map<string, ChartRow>>();
  for (const r of rows) {
    if (!byCurrency.has(r.currency)) byCurrency.set(r.currency, new Map());
    const groupMap = byCurrency.get(r.currency)!;
    const entry = groupMap.get(r.groupKey) || { label: r.groupKey, ad_spend: 0, ai_cost: 0, total: 0 };
    entry[r.category] += r.amount;
    entry.total += r.amount;
    groupMap.set(r.groupKey, entry);
  }
  return Array.from(byCurrency.entries()).map(([currency, groupMap]) => ({
    currency,
    data: Array.from(groupMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
  }));
}

/** (카테고리, 통화)별로 묶어서 합계를 낸다 — 통화가 다르면 그냥 더할 수 없어서 분리해서 보여줌 */
function groupTotals<T extends { category: Category; currency: Currency; amount: number }>(entries: T[]) {
  const map = new Map<string, { category: Category; currency: Currency; amount: number }>();
  for (const e of entries) {
    const key = `${e.category}|${e.currency}`;
    const existing = map.get(key);
    if (existing) existing.amount += e.amount;
    else map.set(key, { category: e.category, currency: e.currency, amount: e.amount });
  }
  return Array.from(map.values());
}

/** groupTotals 결과에 통화별 "합계"(광고비+AI비용) 행을 추가해준다 (같은 통화에 두 카테고리 다 있을 때만) */
function withCurrencyTotals(
  totals: { category: Category; currency: Currency; amount: number }[]
): { category: SeriesKey; currency: Currency; amount: number }[] {
  const byCurrency = new Map<Currency, number>();
  for (const t of totals) byCurrency.set(t.currency, (byCurrency.get(t.currency) ?? 0) + 1);
  const totalRows: { category: SeriesKey; currency: Currency; amount: number }[] = [];
  for (const [currency, count] of Array.from(byCurrency)) {
    if (count < 2) continue;
    const sum = totals.filter((t) => t.currency === currency).reduce((s, t) => s + t.amount, 0);
    totalRows.push({ category: 'total', currency, amount: sum });
  }
  return [...totals, ...totalRows];
}

export default function Expenses() {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewRows, setReviewRows] = useState<ParsedRow[] | null>(null);
  const [reviewCategories, setReviewCategories] = useState<Record<string, Category | null>>({});

  const { data: summary = [] } = trpc.expenses.monthlySummary.useQuery();
  const { data: yearlySummary = [] } = trpc.expenses.yearlySummary.useQuery();
  const parseMutation = trpc.expenses.parse.useMutation();
  const saveMutation = trpc.expenses.save.useMutation();
  const deleteMonthMutation = trpc.expenses.deleteMonth.useMutation();
  const [deletingMonth, setDeletingMonth] = useState<string | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<Set<SeriesKey>>(new Set(ALL_SERIES));

  const toggleSeries = (key: SeriesKey) => {
    setVisibleSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next.size === 0 ? prev : next; // 최소 1개는 켜져 있게
    });
  };

  const availableYears = useMemo(() => {
    const years = new Set(summary.map((r) => r.month.slice(0, 4)));
    return Array.from(years).sort().reverse();
  }, [summary]);

  const [selectedYear, setSelectedYear] = useState('');
  const effectiveYear = selectedYear || availableYears[0] || '';

  const monthlyByMonth = useMemo(() => {
    const map = new Map<string, { category: Category; currency: Currency; amount: number }[]>();
    for (const row of summary) {
      if (!row.month.startsWith(effectiveYear)) continue;
      const list = map.get(row.month) || [];
      list.push({ category: row.category as Category, currency: row.currency as Currency, amount: row.amount });
      map.set(row.month, list);
    }
    return Array.from(map.entries())
      .map(([month, totals]) => ({ month, totals: withCurrencyTotals(totals) }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [summary, effectiveYear]);

  const [selectedYearlyYear, setSelectedYearlyYear] = useState('all');

  const yearlyCharts = useMemo(
    () =>
      buildChartsByCurrency(
        yearlySummary
          .filter((r) => selectedYearlyYear === 'all' || r.year === selectedYearlyYear)
          .map((r) => ({
            category: r.category as Category,
            currency: r.currency as Currency,
            amount: r.amount,
            groupKey: r.year,
          }))
      ),
    [yearlySummary, selectedYearlyYear]
  );

  const monthlyCharts = useMemo(
    () =>
      buildChartsByCurrency(
        summary
          .filter((r) => r.month.startsWith(effectiveYear))
          .map((r) => ({
            category: r.category as Category,
            currency: r.currency as Currency,
            amount: r.amount,
            groupKey: r.month,
          }))
      ),
    [summary, effectiveYear]
  );

  const monthCardsRef = useRef<HTMLDivElement>(null);
  const scrollMonthCards = (dir: 1 | -1) => {
    monthCardsRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' });
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setParsing(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const rows = (await parseMutation.mutateAsync({ data: base64 })) as ParsedRow[];
      const initial: Record<string, Category | null> = {};
      rows.forEach((r) => { initial[r.approvalNo] = r.suggestedCategory; });
      setReviewRows(rows);
      setReviewCategories(initial);
      toast.success(`${rows.length}건을 불러왔어요. 광고비/AI비용에 해당하는 항목을 체크해주세요.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '엑셀을 읽는 데 실패했습니다.');
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleReviewCategory = (approvalNo: string, category: Category) => {
    setReviewCategories((prev) => ({
      ...prev,
      [approvalNo]: prev[approvalNo] === category ? null : category,
    }));
  };

  const checkedEntries = useMemo(() => {
    if (!reviewRows) return [];
    return reviewRows
      .filter((r) => reviewCategories[r.approvalNo])
      .map((r) => ({ ...r, category: reviewCategories[r.approvalNo] as Category }));
  }, [reviewRows, reviewCategories]);

  const checkedTotals = groupTotals(checkedEntries);

  const handleSaveReview = async () => {
    if (checkedEntries.length === 0) {
      toast.error('광고비 또는 AI 비용으로 체크한 항목이 없어요.');
      return;
    }
    setSaving(true);
    try {
      const result = await saveMutation.mutateAsync({ entries: checkedEntries });
      await Promise.all([
        utils.expenses.monthlySummary.invalidate(),
        utils.expenses.yearlySummary.invalidate(),
      ]);
      toast.success(`${result.inserted}건 저장했어요${result.skipped > 0 ? ` (중복 ${result.skipped}건 제외)` : ''}.`);
      setReviewRows(null);
      setReviewCategories({});
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMonth = async (month: string) => {
    if (!window.confirm(`${monthLabel(month)} 저장된 지출을 전부 삭제하시겠습니까? 다시 업로드해서 새로 체크할 수 있어요.`)) return;
    setDeletingMonth(month);
    try {
      await deleteMonthMutation.mutateAsync({ month });
      await Promise.all([
        utils.expenses.monthlySummary.invalidate(),
        utils.expenses.yearlySummary.invalidate(),
      ]);
      toast.success(`${monthLabel(month)} 내역을 삭제했어요.`);
    } catch {
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeletingMonth(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-muted-foreground" />
            지출 관리
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            카드 이용내역 엑셀(국내/해외 모두 가능)을 업로드해서, 광고비·AI 비용에 해당하는 항목만 체크하면 합계를 보여줘요.
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={parsing} className="gap-1.5">
            {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            카드 이용내역 업로드
          </Button>
        </div>
      </div>

      {/* 업로드 직후 검토 화면 */}
      {reviewRows && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">업로드 내역 검토</h2>
            <button
              onClick={() => { setReviewRows(null); setReviewCategories({}); }}
              className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="검토 취소"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            광고비 또는 AI 비용에 해당하는 항목만 버튼을 눌러 체크하세요. 이전에 골랐던 가맹점은 자동으로 미리 체크돼 있어요. 체크하지 않은 항목은 저장되지 않아요.
          </p>

          <div className="flex items-center gap-4 mb-3 px-4 py-2.5 rounded-lg bg-muted/40 text-sm flex-wrap">
            <span className="text-foreground font-semibold">체크한 건수: {checkedEntries.length}건</span>
            {checkedTotals.map((t) => (
              <span key={`${t.category}-${t.currency}`} className={`text-xs flex items-center gap-1 ${CATEGORY_TEXT_CLASS[t.category]}`}>
                {t.category === 'ad_spend' ? <Megaphone className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                {CATEGORY_LABEL[t.category]} {fmt(t.amount, t.currency)}
              </span>
            ))}
          </div>

          <div className="overflow-x-auto -mx-1 px-1 max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground sticky top-0 bg-card">
                  <th className="text-left font-medium py-2 pr-2">날짜</th>
                  <th className="text-left font-medium py-2 pr-2">가맹점</th>
                  <th className="text-right font-medium py-2 pr-2">금액</th>
                  <th className="text-left font-medium py-2 pr-2">카테고리</th>
                </tr>
              </thead>
              <tbody>
                {reviewRows.map((r) => {
                  const current = reviewCategories[r.approvalNo];
                  return (
                    <tr key={r.approvalNo} className="border-b border-border/50">
                      <td className="py-2 pr-2 text-muted-foreground whitespace-nowrap">{r.date}</td>
                      <td className="py-2 pr-2 text-foreground truncate max-w-[220px]">{r.merchant}</td>
                      <td className="py-2 pr-2 text-right text-foreground whitespace-nowrap">{fmt(r.amount, r.currency)}</td>
                      <td className="py-2 pr-2">
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => toggleReviewCategory(r.approvalNo, 'ad_spend')}
                            className={`px-2 py-1 rounded-md text-xs border transition-colors ${current === 'ad_spend' ? CATEGORY_STYLE.ad_spend : 'border-border text-muted-foreground hover:bg-accent'}`}
                          >
                            {CATEGORY_LABEL.ad_spend}
                          </button>
                          <button
                            onClick={() => toggleReviewCategory(r.approvalNo, 'ai_cost')}
                            className={`px-2 py-1 rounded-md text-xs border transition-colors ${current === 'ai_cost' ? CATEGORY_STYLE.ai_cost : 'border-border text-muted-foreground hover:bg-accent'}`}
                          >
                            {CATEGORY_LABEL.ai_cost}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => { setReviewRows(null); setReviewCategories({}); }}>취소</Button>
            <Button size="sm" onClick={handleSaveReview} disabled={saving || checkedEntries.length === 0} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {checkedEntries.length}건 저장
            </Button>
          </div>
        </div>
      )}

      {/* 월별 합계 */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-foreground">월별 합계</h2>
          {availableYears.length > 0 && (
            <Select value={effectiveYear} onValueChange={setSelectedYear}>
              <SelectTrigger size="sm" className="w-full sm:w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y}>{y}년</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {monthlyByMonth.length === 0 ? (
          <p className="text-sm text-muted-foreground">이 연도에 저장된 지출이 없어요.</p>
        ) : (
          <div className="relative">
            <button
              onClick={() => scrollMonthCards(-1)}
              className="hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 items-center justify-center rounded-full border border-border bg-card shadow-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="이전"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div
              ref={monthCardsRef}
              className="overflow-x-auto -mx-1 px-1 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex gap-3 min-w-max">
                {monthlyByMonth.map(({ month, totals }) => (
                  <div key={month} className="group relative snap-start border border-border rounded-lg px-4 py-2.5 pr-7 flex-shrink-0">
                    <button
                      onClick={() => handleDeleteMonth(month)}
                      disabled={deletingMonth === month}
                      className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-md text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-destructive hover:bg-accent transition-opacity"
                      title={`${monthLabel(month)} 삭제`}
                    >
                      {deletingMonth === month ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                    <p className="text-xs text-muted-foreground mb-1">{monthLabel(month)}</p>
                    {totals.map((t) => (
                      <p key={`${t.category}-${t.currency}`} className={`text-xs flex items-center gap-1 ${SERIES_TEXT_CLASS[t.category]}`}>
                        {t.category === 'ad_spend' && <Megaphone className="w-3 h-3" />}
                        {t.category === 'ai_cost' && <Sparkles className="w-3 h-3" />}
                        {t.category === 'total' && <span className="text-[10px]">{SERIES_LABEL.total}</span>}
                        {fmt(t.amount, t.currency)}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => scrollMonthCards(1)}
              className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 items-center justify-center rounded-full border border-border bg-card shadow-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="다음"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 월별 추이 그래프 */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h2 className="text-sm font-semibold text-foreground">월별 추이</h2>
          {availableYears.length > 0 && (
            <Select value={effectiveYear} onValueChange={setSelectedYear}>
              <SelectTrigger size="sm" className="w-full sm:w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y}>{y}년</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          <span className="text-xs text-muted-foreground mr-1">표시:</span>
          {ALL_SERIES.map((key) => (
            <button
              key={key}
              onClick={() => toggleSeries(key)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                visibleSeries.has(key)
                  ? 'text-white border-transparent'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
              style={visibleSeries.has(key) ? { backgroundColor: SERIES_COLOR[key] } : undefined}
            >
              {SERIES_LABEL[key]}
            </button>
          ))}
        </div>
        {monthlyCharts.length === 0 ? (
          <p className="text-sm text-muted-foreground">이 연도에 저장된 지출이 없어요.</p>
        ) : (
          <div className="space-y-6">
            {monthlyCharts.map(({ currency, data }) => (
              <div key={currency}>
                {monthlyCharts.length > 1 && (
                  <p className="text-xs text-muted-foreground mb-2">{currency === 'USD' ? '해외(USD)' : '국내(원화)'}</p>
                )}
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tickFormatter={monthOnlyLabel} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => axisAmount(v, currency)}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={50}
                    />
                    <Tooltip
                      labelFormatter={(label: string) => monthLabel(label)}
                      formatter={(v: number, name: string) => [fmt(v, currency), SERIES_LABEL[name as SeriesKey]]}
                    />
                    <Legend formatter={(name) => SERIES_LABEL[name as SeriesKey]} wrapperStyle={{ fontSize: 12 }} />
                    {visibleSeries.has('ad_spend') && (
                      <Line type="monotone" dataKey="ad_spend" stroke={SERIES_COLOR.ad_spend} strokeWidth={2} dot={{ r: 3 }} />
                    )}
                    {visibleSeries.has('ai_cost') && (
                      <Line type="monotone" dataKey="ai_cost" stroke={SERIES_COLOR.ai_cost} strokeWidth={2} dot={{ r: 3 }} />
                    )}
                    {visibleSeries.has('total') && (
                      <Line type="monotone" dataKey="total" stroke={SERIES_COLOR.total} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 연도별 사용금액 그래프 */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h2 className="text-sm font-semibold text-foreground">연도별 사용금액</h2>
          {availableYears.length > 0 && (
            <Select value={selectedYearlyYear} onValueChange={setSelectedYearlyYear}>
              <SelectTrigger size="sm" className="w-full sm:w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y}>{y}년</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          <span className="text-xs text-muted-foreground mr-1">표시:</span>
          {ALL_SERIES.map((key) => (
            <button
              key={key}
              onClick={() => toggleSeries(key)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                visibleSeries.has(key)
                  ? 'text-white border-transparent'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
              style={visibleSeries.has(key) ? { backgroundColor: SERIES_COLOR[key] } : undefined}
            >
              {SERIES_LABEL[key]}
            </button>
          ))}
        </div>
        {yearlyCharts.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 저장된 지출이 없어요.</p>
        ) : (
          <div className="space-y-6">
            {yearlyCharts.map(({ currency, data }) => (
              <div key={currency}>
                {yearlyCharts.length > 1 && (
                  <p className="text-xs text-muted-foreground mb-2">{currency === 'USD' ? '해외(USD)' : '국내(원화)'}</p>
                )}
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(v) => axisAmount(v, currency)}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={50}
                    />
                    <Tooltip formatter={(v: number, name: string) => [fmt(v, currency), SERIES_LABEL[name as SeriesKey]]} cursor={{ fill: 'var(--accent)' }} />
                    <Legend formatter={(name) => SERIES_LABEL[name as SeriesKey]} wrapperStyle={{ fontSize: 12 }} />
                    {visibleSeries.has('ad_spend') && <Bar dataKey="ad_spend" fill={SERIES_COLOR.ad_spend} radius={[3, 3, 0, 0]} />}
                    {visibleSeries.has('ai_cost') && <Bar dataKey="ai_cost" fill={SERIES_COLOR.ai_cost} radius={[3, 3, 0, 0]} />}
                    {visibleSeries.has('total') && <Bar dataKey="total" fill={SERIES_COLOR.total} radius={[3, 3, 0, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
