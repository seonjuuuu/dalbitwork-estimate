import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocation } from 'wouter';

type EventType = 'consultation' | 'proposal' | 'estimate' | 'contract' | 'pcDraft' | 'mobileDraft' | 'finalDelivery';

const EVENT_STYLE: Record<EventType, { bg: string; text: string; dot: string; label: string }> = {
  consultation:  { bg: 'bg-blue-100 dark:bg-blue-900/40',    text: 'text-blue-700 dark:text-blue-300',    dot: 'bg-blue-500',    label: '상담' },
  proposal:      { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500',  label: '제안서' },
  estimate:      { bg: 'bg-amber-100 dark:bg-amber-900/40',   text: 'text-amber-700 dark:text-amber-300',   dot: 'bg-amber-500',   label: '계약서' },
  contract:      { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', label: '계약일' },
  pcDraft:       { bg: 'bg-sky-100 dark:bg-sky-900/40',       text: 'text-sky-700 dark:text-sky-300',       dot: 'bg-sky-400',     label: 'PC시안' },
  mobileDraft:   { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-400',  label: '모바일시안' },
  finalDelivery: { bg: 'bg-rose-100 dark:bg-rose-900/40',     text: 'text-rose-700 dark:text-rose-300',     dot: 'bg-rose-500',    label: '완성전달' },
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

type CalEvent = { date: string; type: EventType; label: string; id: string; clientId?: number };

function buildEventMap(events: CalEvent[]) {
  const map = new Map<string, CalEvent[]>();
  for (const e of events) {
    const key = e.date.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

// ─── Mini calendar (prev/next month) ─────────────────────────────

function MiniCalendar({
  year,
  month,
  eventMap,
  onSelectDay,
  selectedDay,
}: {
  year: number;
  month: number;
  eventMap: Map<string, CalEvent[]>;
  onSelectDay: (date: string) => void;
  selectedDay: string | null;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = `${year}년 ${month + 1}월`;

  return (
    <div className="bg-card border border-border rounded-xl p-4 w-64 flex-shrink-0">
      <p className="text-xs font-semibold text-muted-foreground text-center mb-3">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((d, i) => (
          <span key={d} className={`text-center text-[10px] font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-muted-foreground'}`}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = toDateStr(year, month, day);
          const dayEvents = eventMap.get(dateStr) || [];
          const isSelected = selectedDay === dateStr;
          const col = i % 7;
          return (
            <button
              key={i}
              onClick={() => onSelectDay(dateStr)}
              className={`relative flex flex-col items-center justify-center rounded-md h-7 text-[11px] font-medium transition-colors
                ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}
                ${col === 0 ? 'text-red-500' : col === 6 ? 'text-blue-500' : 'text-foreground'}
                ${isSelected ? 'text-primary-foreground' : ''}
              `}
            >
              {day}
              {dayEvents.length > 0 && !isSelected && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span key={e.id} className={`w-1 h-1 rounded-full ${EVENT_STYLE[e.type].dot}`} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main calendar ────────────────────────────────────────────────

function MainCalendar({
  year,
  month,
  eventMap,
  onSelectDay,
  selectedDay,
}: {
  year: number;
  month: number;
  eventMap: Map<string, CalEvent[]>;
  onSelectDay: (date: string) => void;
  selectedDay: string | null;
}) {
  const [, navigate] = useLocation();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`py-2 text-center text-xs font-semibold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-muted-foreground'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: `repeat(${cells.length / 7}, 1fr)` }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="border-b border-r border-border/50 last:border-r-0" />;
          const dateStr = toDateStr(year, month, day);
          const dayEvents = eventMap.get(dateStr) || [];
          const isToday = dateStr === todayStr;
          const isSelected = selectedDay === dateStr;
          const col = i % 7;
          const isLastRow = i >= cells.length - 7;

          return (
            <div
              key={i}
              onClick={() => onSelectDay(dateStr)}
              className={`border-b border-r border-border/50 p-1.5 cursor-pointer transition-colors hover:bg-accent/50 flex flex-col gap-1
                ${isLastRow ? 'border-b-0' : ''}
                ${col === 6 ? 'border-r-0' : ''}
                ${isSelected ? 'bg-primary/5' : ''}
              `}
            >
              <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0
                ${isToday ? 'bg-primary text-primary-foreground' : ''}
                ${col === 0 && !isToday ? 'text-red-500' : col === 6 && !isToday ? 'text-blue-500' : 'text-foreground'}
              `}>
                {day}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    onClick={(ev) => {
                      if (e.clientId) { ev.stopPropagation(); navigate(`/clients/${e.clientId}`); }
                    }}
                    className={`text-[10px] px-1.5 py-0.5 rounded truncate leading-tight ${EVENT_STYLE[e.type].bg} ${EVENT_STYLE[e.type].text} ${e.clientId ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''}`}
                  >
                    {EVENT_STYLE[e.type].label} · {e.label}
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3}개</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day detail panel ─────────────────────────────────────────────

function DayDetail({ date, events }: { date: string; events: CalEvent[] }) {
  const [, navigate] = useLocation();
  const d = new Date(date + 'T00:00:00');
  const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;

  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">일정 없음</p>
      ) : (
        events.map((e) => (
          <div
            key={e.id}
            onClick={() => e.clientId && navigate(`/clients/${e.clientId}`)}
            className={`rounded-lg p-3 ${EVENT_STYLE[e.type].bg} ${e.clientId ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
          >
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${EVENT_STYLE[e.type].text}`}>
              {EVENT_STYLE[e.type].label}
            </span>
            <p className={`text-xs font-medium mt-0.5 ${EVENT_STYLE[e.type].text} ${e.clientId ? 'underline underline-offset-2' : ''}`}>
              {e.label}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [rightOpen, setRightOpen] = useState(true);

  const { data: rawEvents = [] } = trpc.calendar.getEvents.useQuery();
  const events = rawEvents as CalEvent[];
  const eventMap = buildEventMap(events);

  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;

  const goToPrev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const goToNext = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };
  const goToToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  const selectedEvents = selectedDay ? (eventMap.get(selectedDay) || []) : [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-foreground">{year}년 {month + 1}월</h1>
          <div className="flex items-center gap-1">
            <button onClick={goToPrev} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={goToToday} className="px-3 h-7 text-xs font-medium rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              오늘
            </button>
            <button onClick={goToNext} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* Legend */}
          <div className="flex items-center gap-4">
            {(Object.entries(EVENT_STYLE) as [EventType, typeof EVENT_STYLE[EventType]][]).map(([type, style]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <span className="text-xs text-muted-foreground">{style.label}</span>
              </div>
            ))}
          </div>

          {/* Right panel toggle */}
          <button
            onClick={() => setRightOpen(o => !o)}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={rightOpen ? '사이드 패널 접기' : '사이드 패널 펼치기'}
          >
            {rightOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: prev month mini */}
        <div className="flex items-start pt-6 pl-4 flex-shrink-0">
          <MiniCalendar
            year={prevYear}
            month={prevMonth}
            eventMap={eventMap}
            onSelectDay={setSelectedDay}
            selectedDay={selectedDay}
          />
        </div>

        {/* Center: main calendar */}
        <div className="flex-1 flex flex-col min-h-0 border-l border-r border-border/60 mx-2 min-w-0">
          <MainCalendar
            year={year}
            month={month}
            eventMap={eventMap}
            onSelectDay={setSelectedDay}
            selectedDay={selectedDay}
          />
        </div>

        {/* Right panel: next month mini + day detail */}
        <div className={`flex flex-col flex-shrink-0 border-l border-border bg-card overflow-hidden transition-all duration-300 ${rightOpen ? 'w-72' : 'w-0'}`}>
          {rightOpen && (
            <>
              <div className="p-4 border-b border-border">
                <MiniCalendar
                  year={nextYear}
                  month={nextMonth}
                  eventMap={eventMap}
                  onSelectDay={setSelectedDay}
                  selectedDay={selectedDay}
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {selectedDay ? (
                  <DayDetail date={selectedDay} events={selectedEvents} />
                ) : (
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground">날짜를 클릭하면 일정이 표시됩니다.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
