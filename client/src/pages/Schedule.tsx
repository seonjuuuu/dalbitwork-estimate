import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = 'consultation' | 'contract' | 'finalPayment';

interface CalendarEvent {
  id: string;
  date: string; // YYYY.MM.DD
  type: EventType;
  clientId: number;
  clientName: string;
  label: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDotDate(str: string): { y: number; m: number; d: number } | null {
  if (!str) return null;
  const parts = str.split('.');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return { y, m, d };
}

function toDateKey(y: number, m: number, d: number): string {
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

const EVENT_STYLE: Record<EventType, { bg: string; text: string; dot: string; label: string }> = {
  consultation: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500', label: '상담' },
  contract:     { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', label: '계약일' },
  finalPayment: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', label: '잔금' },
};

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Schedule() {
  const [, navigate] = useLocation();
  const todayJs = new Date();
  const [viewYear, setViewYear] = useState(todayJs.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayJs.getMonth() + 1); // 1-12
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);

  const { data, isLoading } = trpc.clients.getCalendarEvents.useQuery();

  // Build events list from raw data
  const allEvents = useMemo<CalendarEvent[]>(() => {
    if (!data) return [];
    const events: CalendarEvent[] = [];

    for (const c of data.consultations) {
      if (parseDotDate(c.date)) {
        events.push({
          id: `consult-${c.id}`,
          date: c.date,
          type: 'consultation',
          clientId: c.clientId,
          clientName: c.clientName,
          label: c.content.slice(0, 20) + (c.content.length > 20 ? '…' : ''),
        });
      }
    }

    for (const cl of data.clients) {
      if (cl.contractDate && parseDotDate(cl.contractDate)) {
        events.push({
          id: `contract-${cl.id}`,
          date: cl.contractDate,
          type: 'contract',
          clientId: cl.id,
          clientName: cl.name,
          label: `${cl.contractAmount > 0 ? cl.contractAmount.toLocaleString('ko-KR') + '원' : ''}`,
        });
      }
      if (cl.finalPaymentDate && parseDotDate(cl.finalPaymentDate)) {
        events.push({
          id: `final-${cl.id}`,
          date: cl.finalPaymentDate,
          type: 'finalPayment',
          clientId: cl.id,
          clientName: cl.name,
          label: cl.finalPaymentAmount ? `${cl.finalPaymentAmount.toLocaleString('ko-KR')}원` : '',
        });
      }
    }

    return events;
  }, [data]);

  // Group events by date key
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of allEvents) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [allEvents]);

  // Build calendar grid (Mon–Sun, 6 rows max)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    const lastDay = new Date(viewYear, viewMonth, 0);
    // Mon=0 … Sun=6
    const startOffset = (firstDay.getDay() + 6) % 7;
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

    const days: Array<{ key: string; dateKey: string; day: number; isCurrentMonth: boolean; isToday: boolean }> = [];
    for (let i = 0; i < totalCells; i++) {
      const date = new Date(viewYear, viewMonth - 1, 1 - startOffset + i);
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const d = date.getDate();
      const dateKey = toDateKey(y, m, d);
      const isCurrentMonth = m === viewMonth && y === viewYear;
      const isToday =
        y === todayJs.getFullYear() && m === todayJs.getMonth() + 1 && d === todayJs.getDate();
      days.push({ key: `${i}`, dateKey, day: d, isCurrentMonth, isToday });
    }
    return days;
  }, [viewYear, viewMonth]);

  const goToPrev = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  };
  const goToNext = () => {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  };
  const goToToday = () => {
    setViewYear(todayJs.getFullYear());
    setViewMonth(todayJs.getMonth() + 1);
  };

  // Count events for current month (for header subtitle)
  const monthEventCount = allEvents.filter(ev => {
    const p = parseDotDate(ev.date);
    return p && p.y === viewYear && p.m === viewMonth;
  }).length;

  return (
    <div className="p-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-muted-foreground" />
            진행 일정
          </h1>
          {monthEventCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">{viewYear}년 {viewMonth}월 · {monthEventCount}건</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday} className="h-8 text-xs">오늘</Button>
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button onClick={goToPrev} className="h-8 w-8 flex items-center justify-center hover:bg-accent transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-semibold min-w-[90px] text-center">
              {viewYear}년 {viewMonth}월
            </span>
            <button onClick={goToNext} className="h-8 w-8 flex items-center justify-center hover:bg-accent transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        {(Object.entries(EVENT_STYLE) as [EventType, typeof EVENT_STYLE[EventType]][]).map(([type, s]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">불러오는 중...</div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAY_LABELS.map((label, i) => (
              <div
                key={label}
                className={`py-2 text-center text-xs font-semibold ${
                  i === 5 ? 'text-blue-500' : i === 6 ? 'text-red-500' : 'text-muted-foreground'
                }`}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 divide-x divide-border">
            {calendarDays.map((cell, idx) => {
              const events = eventsByDate.get(cell.dateKey) ?? [];
              const isWeekend = idx % 7 >= 5;
              const showMore = events.length > 3;
              const visibleEvents = events.slice(0, 3);

              return (
                <div
                  key={cell.key}
                  className={`min-h-[90px] p-1.5 border-b border-border transition-colors ${
                    !cell.isCurrentMonth ? 'bg-muted/20' : ''
                  } ${events.length > 0 ? 'hover:bg-accent/20' : ''}`}
                >
                  {/* Date number */}
                  <div className="flex justify-end mb-1">
                    <span
                      className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                        cell.isToday
                          ? 'bg-primary text-primary-foreground font-bold'
                          : !cell.isCurrentMonth
                          ? 'text-muted-foreground/40'
                          : isWeekend
                          ? idx % 7 === 5 ? 'text-blue-500' : 'text-red-500'
                          : 'text-foreground'
                      }`}
                    >
                      {cell.day}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="space-y-0.5">
                    {visibleEvents.map(ev => {
                      const s = EVENT_STYLE[ev.type];
                      return (
                        <button
                          key={ev.id}
                          onClick={() => navigate(`/clients/${ev.clientId}`)}
                          onMouseEnter={() => setHoveredEvent(ev.id)}
                          onMouseLeave={() => setHoveredEvent(null)}
                          className={`w-full text-left rounded px-1.5 py-0.5 text-[11px] font-medium flex items-center gap-1 truncate transition-opacity ${s.bg} ${s.text} ${
                            hoveredEvent === ev.id ? 'opacity-80' : ''
                          }`}
                          title={`${ev.clientName}${ev.label ? ` · ${ev.label}` : ''}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                          <span className="truncate">{ev.clientName}</span>
                        </button>
                      );
                    })}
                    {showMore && (
                      <div className="text-[10px] text-muted-foreground px-1">+{events.length - 3}건 더</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly event list (below calendar for easy scanning) */}
      {monthEventCount > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">{viewYear}년 {viewMonth}월 일정 목록</h2>
          <div className="space-y-1.5">
            {allEvents
              .filter(ev => {
                const p = parseDotDate(ev.date);
                return p && p.y === viewYear && p.m === viewMonth;
              })
              .sort((a, b) => a.date.localeCompare(b.date))
              .map(ev => {
                const s = EVENT_STYLE[ev.type];
                const p = parseDotDate(ev.date)!;
                return (
                  <button
                    key={ev.id}
                    onClick={() => navigate(`/clients/${ev.clientId}`)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left"
                  >
                    <span className={`text-xs font-bold w-7 text-center ${p.d === todayJs.getDate() && viewMonth === todayJs.getMonth() + 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {String(p.d).padStart(2, '0')}일
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.bg} ${s.text} flex-shrink-0`}>
                      {s.label}
                    </span>
                    <span className="text-sm font-medium text-foreground">{ev.clientName}</span>
                    {ev.label && (
                      <span className="text-xs text-muted-foreground truncate">{ev.label}</span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
