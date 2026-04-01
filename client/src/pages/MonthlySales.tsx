import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function MonthlySales() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const monthString = `${selectedYear}년 ${selectedMonth}월`;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">월별 매출</h1>
        <p className="text-sm text-muted-foreground mt-2">
          월별 매출 현황을 조회하고 분석할 수 있습니다.
        </p>
      </div>

      {/* Month Selector */}
      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            이전
          </Button>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">{monthString}</h2>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            className="gap-1"
          >
            다음
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Sales Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            총 매출
          </div>
          <div className="text-3xl font-bold text-foreground">
            0원
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            0건의 견적서
          </p>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            평균 계약금
          </div>
          <div className="text-3xl font-bold text-foreground">
            0원
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            계약금 합계
          </p>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            잔금 대기
          </div>
          <div className="text-3xl font-bold text-foreground">
            0원
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            미수금 현황
          </p>
        </Card>
      </div>

      {/* Sales Details Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          매출 상세 내역
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                  날짜
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                  고객사
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                  프로젝트명
                </th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                  계약금
                </th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                  잔금
                </th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                  총액
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                <td colSpan={6} className="py-8 px-4 text-center text-muted-foreground">
                  {monthString}의 매출 데이터가 없습니다.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
