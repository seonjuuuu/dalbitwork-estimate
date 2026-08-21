import { useMemo, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Loader2, Megaphone, Sparkles, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

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

export default function Expenses() {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewRows, setReviewRows] = useState<ParsedRow[] | null>(null);
  const [reviewCategories, setReviewCategories] = useState<Record<string, Category | null>>({});

  const { data: summary = [] } = trpc.expenses.monthlySummary.useQuery();
  const parseMutation = trpc.expenses.parse.useMutation();
  const saveMutation = trpc.expenses.save.useMutation();

  const monthlyByMonth = useMemo(() => {
    const map = new Map<string, { category: Category; currency: Currency; amount: number }[]>();
    for (const row of summary) {
      const list = map.get(row.month) || [];
      list.push({ category: row.category as Category, currency: row.currency as Currency, amount: row.amount });
      map.set(row.month, list);
    }
    return Array.from(map.entries())
      .map(([month, totals]) => ({ month, totals }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [summary]);

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
      await utils.expenses.monthlySummary.invalidate();
      toast.success(`${result.inserted}건 저장했어요${result.skipped > 0 ? ` (중복 ${result.skipped}건 제외)` : ''}.`);
      setReviewRows(null);
      setReviewCategories({});
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
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
        <h2 className="text-sm font-semibold text-foreground mb-3">월별 합계</h2>
        {monthlyByMonth.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 저장된 지출이 없어요. 엑셀을 업로드해서 시작해보세요.</p>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="flex gap-3 min-w-max">
              {monthlyByMonth.map(({ month, totals }) => (
                <div key={month} className="border border-border rounded-lg px-4 py-2.5 flex-shrink-0">
                  <p className="text-xs text-muted-foreground mb-1">{monthLabel(month)}</p>
                  {totals.map((t) => (
                    <p key={`${t.category}-${t.currency}`} className={`text-xs flex items-center gap-1 ${CATEGORY_TEXT_CLASS[t.category]}`}>
                      {t.category === 'ad_spend' ? <Megaphone className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                      {fmt(t.amount, t.currency)}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
