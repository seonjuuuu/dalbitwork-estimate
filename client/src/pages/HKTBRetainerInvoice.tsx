import { useState, useCallback, useRef, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import { nanoid } from 'nanoid';
import { Plus, Trash2, Download, Eye, Loader2, Save, FolderOpen, ChevronDown, ChevronRight, TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import HKTBRetainerPdf, { type HKTBRetainerData, type HKTBRetainerItem } from '@/components/HKTBRetainerPdf';

function autoFormatNumber(input: string): string {
  const digits = input.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return parseInt(digits).toLocaleString('en-US');
}

function parseNum(s: string): number {
  return parseInt(s.replace(/,/g, '')) || 0;
}

function calcItem(item: HKTBRetainerItem) {
  const price = parseNum(item.price);
  const vat = Math.round(price * 0.1);
  const total = price + vat;
  return { price, vat, total };
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

// 해당 월의 마지막 날 반환
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// 특정 연도+월의 dateFrom/dateTo 생성
function getMonthRange(month: number, year: number) {
  const mm = String(month).padStart(2, '0');
  const last = String(lastDayOfMonth(year, month)).padStart(2, '0');
  return {
    dateFrom: `${year}.${mm}.01`,
    dateTo: `${year}.${mm}.${last}`,
  };
}

// 4-5, 6-7, 8-9, 10-11, 12-1, 2-3 순서
// 12-1은 연도 경계: 12월=올해, 1월=내년 / 2-3은 내년
const THIS_YEAR = new Date().getFullYear();
type MonthYearPair = { month: number; year: number };
const MONTH_PAIRS: { label: string; ranges: [MonthYearPair, MonthYearPair] }[] = [
  { label: '4 - 5월',  ranges: [{ month: 4,  year: THIS_YEAR },     { month: 5,  year: THIS_YEAR }] },
  { label: '6 - 7월',  ranges: [{ month: 6,  year: THIS_YEAR },     { month: 7,  year: THIS_YEAR }] },
  { label: '8 - 9월',  ranges: [{ month: 8,  year: THIS_YEAR },     { month: 9,  year: THIS_YEAR }] },
  { label: '10 - 11월',ranges: [{ month: 10, year: THIS_YEAR },     { month: 11, year: THIS_YEAR }] },
  { label: '12 - 1월', ranges: [{ month: 12, year: THIS_YEAR },     { month: 1,  year: THIS_YEAR + 1 }] },
  { label: '2 - 3월',  ranges: [{ month: 2,  year: THIS_YEAR + 1 }, { month: 3,  year: THIS_YEAR + 1 }] },
];

function makeDefaultData(): HKTBRetainerData {
  const today = new Date().toISOString().split('T')[0];
  return {
    invoiceNo: `${today.replace(/-/g, '')}001A`,
    invoiceDate: today,
    items: [
      { id: nanoid(), dateFrom: '', dateTo: '', jobDescription: 'Retainer Fee', price: '850,000' },
      { id: nanoid(), dateFrom: '', dateTo: '', jobDescription: 'Retainer Fee', price: '850,000' },
    ],
  };
}

export default function HKTBRetainerInvoice() {
  const [data, setData] = useState<HKTBRetainerData>(makeDefaultData);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);
  const [revenueMonth, setRevenueMonth] = useState<string>('');
  const [showRevenueInput, setShowRevenueInput] = useState(false);
  const prevBlobUrlRef = useRef<string | null>(null);
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: savedList, refetch: refetchList } = trpc.hktbInvoices.list.useQuery({ type: 'retainer' });
  const createMutation = trpc.hktbInvoices.create.useMutation();
  const updateMutation = trpc.hktbInvoices.update.useMutation();
  const deleteMutation = trpc.hktbInvoices.delete.useMutation();

  const renderPreview = useCallback(async () => {
    setIsRendering(true);
    try {
      const blob = await pdf(<HKTBRetainerPdf data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      if (prevBlobUrlRef.current) URL.revokeObjectURL(prevBlobUrlRef.current);
      prevBlobUrlRef.current = url;
      setPdfBlobUrl(url);
    } catch (err) {
      console.error('PDF 렌더 오류:', err);
    } finally {
      setIsRendering(false);
    }
  }, [data]);

  useEffect(() => {
    if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    renderTimeoutRef.current = setTimeout(renderPreview, 600);
    return () => { if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current); };
  }, [renderPreview]);

  // 인보이스 날짜 변경 시 번호 앞 8자리(날짜) 자동 갱신, 뒤 시퀀스는 유지
  useEffect(() => {
    if (!data.invoiceDate) return;
    const datePart = data.invoiceDate.replace(/-/g, '');
    if (data.invoiceNo.startsWith(datePart)) return;
    const suffix = data.invoiceNo.length >= 8 ? data.invoiceNo.slice(8) : '001A';
    setData(prev => ({ ...prev, invoiceNo: datePart + (suffix || '001A') }));
  }, [data.invoiceDate]);

  const calcTotal = () =>
    data.items.reduce((sum, item) => {
      const price = parseNum(item.price);
      return sum + price + Math.round(price * 0.1);
    }, 0);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        type: 'retainer' as const,
        invoiceNo: data.invoiceNo,
        invoiceDate: data.invoiceDate,
        items: data.items as unknown as Record<string, unknown>[],
        totalAmount: calcTotal(),
      };
      if (savedId) {
        await updateMutation.mutateAsync({ id: savedId, ...payload });
        toast.success('저장되었습니다.');
      } else {
        const result = await createMutation.mutateAsync(payload);
        if (result) setSavedId(result.id);
        toast.success('저장되었습니다.');
      }
      refetchList();
    } catch {
      toast.error('저장 실패');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoad = (inv: NonNullable<typeof savedList>[number]) => {
    setData({
      invoiceNo: inv.invoiceNo,
      invoiceDate: inv.invoiceDate,
      items: (inv.items as HKTBRetainerItem[]) ?? [],
    });
    setSavedId(inv.id);
    setSelectedPair(null);
    setRevenueMonth(inv.revenueMonth ?? '');
    setShowRevenueInput(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await deleteMutation.mutateAsync({ id });
    if (savedId === id) { setData(makeDefaultData()); setSavedId(null); }
    refetchList();
    toast.success('삭제되었습니다.');
  };

  const handleNew = () => { setData(makeDefaultData()); setSavedId(null); setSelectedPair(null); setRevenueMonth(''); setShowRevenueInput(false); };

  const handleRegisterRevenue = async (month: string) => {
    if (!savedId) { toast.error('먼저 저장해주세요'); return; }
    await updateMutation.mutateAsync({ id: savedId, revenueMonth: month || null });
    setRevenueMonth(month);
    setShowRevenueInput(false);
    refetchList();
    toast.success(month ? `${month} 매출로 등록됐습니다` : '매출 등록이 해제됐습니다');
  };

  // 기간 선택 시 다음 달을 매출 등록 기본값으로 제안
  const suggestRevenueMonth = (pairIdx: number): string => {
    const [, r2] = MONTH_PAIRS[pairIdx].ranges;
    const nextMonth = r2.month === 12 ? 1 : r2.month + 1;
    const nextYear = r2.month === 12 ? r2.year + 1 : r2.year;
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await pdf(<HKTBRetainerPdf data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HKTB-RETAINER-${data.invoiceNo || 'draft'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('다운로드 완료');
    } catch {
      toast.error('다운로드 실패');
    } finally {
      setIsDownloading(false);
    }
  };

  const updateItem = (id: string, field: keyof HKTBRetainerItem, value: string) => {
    setData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item),
    }));
  };

  const [selectedPair, setSelectedPair] = useState<number | null>(null);

  const selectPair = (pairIdx: number) => {
    setSelectedPair(pairIdx);
    const [r1, r2] = MONTH_PAIRS[pairIdx].ranges;
    const range1 = getMonthRange(r1.month, r1.year);
    const range2 = getMonthRange(r2.month, r2.year);
    setData(prev => {
      const items = [...prev.items];
      if (items[0]) items[0] = { ...items[0], ...range1 };
      if (items[1]) items[1] = { ...items[1], ...range2 };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setData(prev => ({
      ...prev,
      items: [...prev.items, { id: nanoid(), dateFrom: '', dateTo: '', jobDescription: 'Retainer Fee', price: '850,000' }],
    }));
  };

  const removeItem = (id: string) => {
    setData(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }));
  };

  const grandTotal = data.items.reduce((sum, item) => sum + calcItem(item).total, 0);

  return (
    <div className="px-6 py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">홍콩관광청 관리용 Invoice</h1>
          <p className="text-sm text-muted-foreground mt-1">HKTB Retainer Fee 전용 인보이스</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleNew} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            새 인보이스
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowPreview(v => !v)} className="gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            {showPreview ? '폼만 보기' : '미리보기'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {savedId ? '업데이트' : '저장'}
          </Button>
          {savedId && (
            revenueMonth ? (
              <div className="flex items-center gap-1 px-2.5 h-8 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                <TrendingUp className="w-3 h-3" />
                <span>{revenueMonth.replace('-', '년 ').replace(/^(\d+년 )0?(\d+)$/, '$1$2')}월 매출</span>
                <button onClick={() => handleRegisterRevenue('')} className="ml-0.5 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {showRevenueInput ? (
                  <>
                    <input
                      type="month"
                      className="h-8 rounded-md border border-border px-2 text-xs"
                      defaultValue={selectedPair !== null ? suggestRevenueMonth(selectedPair) : (() => {
                        const d = new Date(data.invoiceDate);
                        d.setMonth(d.getMonth() + 1);
                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      })()}
                      id="revenue-month-input-retainer"
                    />
                    <Button size="sm" className="h-8 text-xs gap-1" onClick={() => {
                      const val = (document.getElementById('revenue-month-input-retainer') as HTMLInputElement)?.value;
                      if (val) handleRegisterRevenue(val);
                    }}>확인</Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowRevenueInput(false)}>취소</Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowRevenueInput(true)} className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                    <TrendingUp className="w-3.5 h-3.5" />
                    매출 등록
                  </Button>
                )}
              </div>
            )
          )}
          <Button size="sm" onClick={handleDownload} disabled={isDownloading} className="gap-1.5">
            {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF 다운로드
          </Button>
        </div>
      </div>

      {/* 3단 레이아웃: 목록 | 폼 | 미리보기 */}
      <div className="flex gap-5 items-start">
        {/* 왼쪽: 저장 목록 */}
        <div className={`shrink-0 sticky top-6 bg-card border border-border rounded-lg overflow-hidden transition-all duration-200 ${sidebarOpen ? 'w-52' : 'w-9'}`}>
          <div className="flex items-center border-b border-border">
            <button
              className="p-2.5 hover:bg-muted/40 transition-colors"
              onClick={() => setSidebarOpen(v => !v)}
            >
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {sidebarOpen && (
              <button
                className="flex items-center gap-1 flex-1 pr-2.5 py-2.5 hover:bg-muted/40 transition-colors min-w-0"
                onClick={() => setListOpen(v => !v)}
              >
                <span className="text-xs font-semibold text-foreground flex-1 text-left truncate">저장된 목록</span>
                {listOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
              </button>
            )}
          </div>
          {sidebarOpen && listOpen && (
            <div className="max-h-[600px] overflow-y-auto">
              {savedList && savedList.length > 0 ? (
                <div className="p-2 space-y-1">
                  {savedList.map(inv => {
                    const items = inv.items as { dateFrom?: string; dateTo?: string }[];
                    const first = items[0];
                    const last = items[items.length - 1];
                    const fromM = first?.dateFrom?.split('.')[1];
                    const toM = last?.dateTo?.split('.')[1];
                    const periodLabel = fromM && toM ? `${parseInt(fromM)}-${parseInt(toM)}월` : inv.invoiceDate.slice(0, 7);
                    return (
                      <div
                        key={inv.id}
                        className={`group rounded-md border transition-colors ${
                          savedId === inv.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/60'
                        }`}
                      >
                        <button className="w-full text-left p-2" onClick={() => handleLoad(inv)}>
                          <div className="text-[10px] font-semibold text-primary mb-0.5">{periodLabel}</div>
                          <div className="text-xs font-mono font-medium text-foreground truncate">{inv.invoiceNo}</div>
                          <div className="text-[10px] text-muted-foreground">{inv.totalAmount.toLocaleString('en-US')}</div>
                        </button>
                        <div className="flex justify-end px-2 pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleDelete(inv.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  저장된 인보이스가 없습니다
                </div>
              )}
            </div>
          )}
        </div>

        {/* 가운데+오른쪽: 폼 + 미리보기 */}
        <div className={`flex-1 min-w-0 ${showPreview ? 'grid grid-cols-2 gap-5' : ''}`}>
        {/* Form */}
        <div className="space-y-6">
          {/* Invoice meta */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">인보이스 정보</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Invoice No.</label>
                <Input
                  value={data.invoiceNo}
                  onChange={e => setData(prev => ({ ...prev, invoiceNo: e.target.value }))}
                  placeholder="20260302001A"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Date of Invoice</label>
                <Input
                  type="date"
                  value={data.invoiceDate}
                  onChange={e => setData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          {/* Fixed info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/40 border border-border rounded-lg p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">FROM. (SELLER)</p>
              <p className="text-xs font-bold">DalBit Work</p>
              <p className="text-xs text-muted-foreground mt-1">186, Biryong-ro, Hwado-eup, Namyangju-si</p>
              <p className="text-xs text-muted-foreground">Gyeonggi-do, Republic of Korea</p>
              <p className="text-xs text-muted-foreground">m.seonjuuu@gmail.com</p>
              <p className="text-xs text-muted-foreground">+82 10-8985-3954</p>
            </div>
            <div className="bg-muted/40 border border-border rounded-lg p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">To. (BUYER)</p>
              <p className="text-xs font-bold">HKTB (Hong Kong Tourism Board)</p>
              <p className="text-xs text-muted-foreground mt-1">11/F, 16, Eulji-ro, Jung-gu</p>
              <p className="text-xs text-muted-foreground">Seoul, Republic of Korea</p>
              <p className="text-xs text-muted-foreground">+82 2 778 4403</p>
            </div>
          </div>

          {/* Items */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">작업 내역</h2>
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" />
                항목 추가
              </Button>
            </div>

            {/* 기간 빠른 선택 */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">기간 선택</p>
              <div className="flex flex-wrap gap-1.5">
                {MONTH_PAIRS.map((pair, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectPair(idx)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      selectedPair === idx
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`}
                  >
                    {pair.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {data.items.map((item, idx) => {
                const { price, vat, total } = calcItem(item);
                return (
                  <div key={item.id} className="border border-border rounded-md p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">항목 {idx + 1}</span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-[1fr_1fr_1fr_110px] gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">시작일</label>
                        <Input
                          value={item.dateFrom}
                          onChange={e => updateItem(item.id, 'dateFrom', e.target.value)}
                          placeholder="2026.04.01"
                          className="text-xs h-8"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">종료일</label>
                        <Input
                          value={item.dateTo}
                          onChange={e => updateItem(item.id, 'dateTo', e.target.value)}
                          placeholder="2026.04.30"
                          className="text-xs h-8"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Job Description</label>
                        <Input
                          value={item.jobDescription}
                          onChange={e => updateItem(item.id, 'jobDescription', e.target.value)}
                          placeholder="Retainer Fee"
                          className="text-xs h-8"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Price</label>
                        <Input
                          value={item.price}
                          onChange={e => updateItem(item.id, 'price', autoFormatNumber(e.target.value))}
                          placeholder="850,000"
                          className="text-xs h-8 text-right"
                        />
                      </div>
                    </div>

                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Price: <strong className="text-foreground">{fmt(price)}</strong></span>
                      <span>VAT (10%): <strong className="text-foreground">{fmt(vat)}</strong></span>
                      <span>Total: <strong className="text-foreground">{fmt(total)}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-border flex justify-end items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Total Price</span>
              <span className="text-base font-bold text-foreground">{fmt(grandTotal)}</span>
            </div>
          </div>

          {/* Bank info */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="bg-[#F7AE00] px-4 py-2 text-center text-xs font-bold tracking-widest">
              BANK INFORMATION
            </div>
            <div className="p-4 space-y-1.5">
              {[
                ['BANK NAME', 'KOOKMIN BANK'],
                ['ADDRESS', '#26, Gukjegeumyung-ro 8-gil, Yeongdeungpo-gu, Seoul, Korea'],
                ['Tel', '+82 1588-9999'],
                ['SWIFT NO', 'CZNBKRSE'],
                ['ACC NO', '616337-04-005356'],
                ['ACC NAME', '문선주 (달빛워크)'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4 text-xs">
                  <span className="w-20 font-semibold text-muted-foreground shrink-0">{label}</span>
                  <span className="text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="sticky top-6 self-start">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold">PDF 미리보기</span>
                {isRendering && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="relative bg-muted/30" style={{ height: 700 }}>
                {pdfBlobUrl ? (
                  <iframe src={pdfBlobUrl} className="w-full h-full border-0" title="Retainer Invoice Preview" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
