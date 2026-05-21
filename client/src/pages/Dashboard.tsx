import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { FileText, FileCheck, Building2, TrendingUp, AlertCircle, Loader2, Edit } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#94a3b8', '#60a5fa', '#F7AE00'];

function formatAmount(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString('ko-KR')}만`;
  return n.toLocaleString('ko-KR');
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.dashboard.getData.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const {
    thisMonthContractCount,
    thisMonthContractAmount,
    unpaidAmount,
    consultingCount,
    recentDocs,
    monthlySummary,
    clientStatus,
  } = data;

  const now = new Date();
  const monthLabel = `${now.getMonth() + 1}월`;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">{now.getFullYear()}년 {monthLabel} 현황</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={FileCheck}
          label={`${monthLabel} 계약 건수`}
          value={`${thisMonthContractCount}건`}
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
        />
        <SummaryCard
          icon={TrendingUp}
          label={`${monthLabel} 계약 금액`}
          value={`${formatAmount(thisMonthContractAmount)}원`}
          sub={thisMonthContractAmount > 0 ? `${thisMonthContractAmount.toLocaleString('ko-KR')}원` : undefined}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <SummaryCard
          icon={Building2}
          label="상담 중 고객"
          value={`${consultingCount}명`}
          sub="계약 전 고객"
          color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
        />
        <SummaryCard
          icon={AlertCircle}
          label="미수금"
          value={unpaidAmount > 0 ? `${formatAmount(unpaidAmount)}원` : '없음'}
          sub={unpaidAmount > 0 ? `${unpaidAmount.toLocaleString('ko-KR')}원` : undefined}
          color={unpaidAmount > 0
            ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'}
        />
      </div>

      {/* 중간: 최근 활동 + 도넛 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 최근 활동 */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">최근 활동</h2>
          {recentDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">저장된 문서가 없습니다.</p>
          ) : (
            <div className="space-y-1">
              {recentDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => navigate(doc.type === 'proposal' ? `/proposals/${doc.id}` : `/estimates/${doc.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left group"
                >
                  <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                    doc.type === 'proposal'
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                    {doc.type === 'proposal'
                      ? <FileText className="w-3.5 h-3.5" />
                      : <FileCheck className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {doc.title || '(제목 없음)'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.clientName || '(고객사 없음)'} · {doc.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {doc.totalMin > 0 && (
                      <span className="text-xs font-semibold text-foreground">
                        {formatAmount(doc.totalMin)}원
                      </span>
                    )}
                    <Edit className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 상담 vs 계약 도넛 */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">고객 현황</h2>
          {clientStatus[0].value === 0 && clientStatus[1].value === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">등록된 고객이 없습니다.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={clientStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {clientStatus.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}명`} />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-2">
                {clientStatus.map((s, i) => (
                  <div key={s.name} className="text-center">
                    <p className="text-lg font-bold" style={{ color: COLORS[i] }}>{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.name}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 월별 매출 막대 차트 */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-foreground mb-6">최근 6개월 계약 금액</h2>
        {monthlySummary.every(m => m.amount === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-8">계약 데이터가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlySummary} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => v === 0 ? '0' : formatAmount(v)}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                formatter={(v: number) => [`${v.toLocaleString('ko-KR')}원`, '계약금액']}
                cursor={{ fill: 'var(--accent)' }}
              />
              <Bar dataKey="amount" fill="#F7AE00" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
