import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { CalendarDays, CheckSquare, Clock, ListTodo } from 'lucide-react';

const EVENT_TYPE_LABELS: Record<string, string> = {
  consultation: '상담',
  proposal: '제안서',
  estimate: '계약서',
  contract: '계약일',
  pcDraft: 'PC시안',
  mobileDraft: '모바일시안',
  finalDelivery: '완성전달',
  custom: '일정',
};

type CalEvent = {
  date: string;
  type: string;
  label: string;
  id: string;
  clientId?: number;
  isMeeting?: boolean;
  time?: string | null;
  timeUnknown?: boolean;
};

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function eventTimeLabel(e: CalEvent): string | null {
  if (!e.isMeeting) return null;
  if (e.timeUnknown) return '시간 미정';
  if (e.time) return e.time;
  return null;
}

export default function TodayBriefCard() {
  const [, navigate] = useLocation();
  const { data: rawEvents = [] } = trpc.calendar.getEvents.useQuery();
  const { data: todos = [] } = trpc.todos.list.useQuery();

  const events = rawEvents as CalEvent[];
  const todayStr = toDateStr(new Date());
  // 마감일이 오늘인 할 일도 "오늘 일정"에 함께 표시 (아래 "오늘 할 일" 목록에는 항상 전부 뜸)
  const todayEvents = events.filter((e) => e.date === todayStr);
  const incompleteTodos = todos.filter((t) => !t.completed);

  const hasNothing = todayEvents.length === 0 && incompleteTodos.length === 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        오늘
      </h2>

      {hasNothing ? (
        <p className="text-sm text-muted-foreground">오늘은 일정도, 남은 할 일도 없어요. 편안한 하루 보내세요!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <button
              onClick={() => navigate('/calendar')}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2 hover:text-foreground transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              오늘 일정 {todayEvents.length > 0 && `(${todayEvents.length})`}
            </button>
            {todayEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">오늘 등록된 일정이 없어요.</p>
            ) : (
              <ul className="space-y-1.5">
                {todayEvents.slice(0, 5).map((e) => (
                  <li key={e.id} className="text-sm text-foreground truncate">
                    <span className="text-xs text-muted-foreground">{EVENT_TYPE_LABELS[e.type] || e.type}</span>
                    {' · '}
                    {e.label}
                    {eventTimeLabel(e) && <span className="text-xs text-muted-foreground"> ({eventTimeLabel(e)})</span>}
                  </li>
                ))}
                {todayEvents.length > 5 && (
                  <li className="text-xs text-muted-foreground">외 {todayEvents.length - 5}건</li>
                )}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
              <ListTodo className="w-3.5 h-3.5" />
              오늘 할 일 {incompleteTodos.length > 0 && `(${incompleteTodos.length})`}
            </div>
            {incompleteTodos.length === 0 ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckSquare className="w-3.5 h-3.5" />
                남은 할 일이 없어요.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {incompleteTodos.slice(0, 5).map((t) => (
                  <li key={t.id} className="text-sm text-foreground truncate">{t.content}</li>
                ))}
                {incompleteTodos.length > 5 && (
                  <li className="text-xs text-muted-foreground">외 {incompleteTodos.length - 5}개</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
