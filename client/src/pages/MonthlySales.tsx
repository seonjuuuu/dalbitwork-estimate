import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { trpc } from '@/lib/trpc';

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원';
}

function typeLabel(type: string) {
  return type === 'translation' ? '번역' : '관리';
}

export default function MonthlySales() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1); }
    else setSelectedMonth(selectedMonth - 1);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1); }
    else setSelectedMonth(selectedMonth + 1);
  };

  const { data } = trpc.sales.getMonthly.useQuery({ year: selectedYear, month: selectedMonth });

  const payments = data?.payments ?? [];
  const hktbInvoices = data?.hktbInvoices ?? [];

  const paymentTotal = payments.reduce((s, p) => s + p.amount, 0);
  const hktbTotal = hktbInvoices.reduce((s, h) => s + h.totalAmount, 0);
  const grandTotal = paymentTotal + hktbTotal;

  const monthString = `${selectedYear}년 ${selectedMonth}월`;

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

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <div className="text-xs font-medium text-muted-foreground mb-1">총 매출</div>
          <div className="text-2xl font-bold text-foreground">{fmt(grandTotal)}</div>
          <p className="text-xs text-muted-foreground mt-1">{payments.length + hktbInvoices.length}건</p>
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
            </tr>
          </thead>
          <tbody>
            {payments.length > 0 ? payments.map((p, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 text-xs text-muted-foreground">{p.paymentDate}</td>
                <td className="py-2.5 px-3 text-xs">{p.clientName}</td>
                <td className="py-2.5 px-3 text-xs text-muted-foreground">{p.documentTitle}</td>
                <td className="py-2.5 px-3">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${p.type === 'deposit' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {p.type === 'deposit' ? '계약금' : '잔금'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-semibold">{fmt(p.amount)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="py-8 px-3 text-center text-xs text-muted-foreground">
                  {monthString}의 일반 매출 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
