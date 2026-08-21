import * as db from "./db";
import { notifyUser } from "./push";

const MAX_ITEMS_IN_BODY = 6;

const EVENT_TYPE_LABELS: Record<string, string> = {
  consultation: "상담",
  proposal: "제안서",
  estimate: "계약서",
  contract: "계약일",
  pcDraft: "PC시안",
  mobileDraft: "모바일시안",
  finalDelivery: "완성전달",
  custom: "일정",
};

// 미팅(custom)이나 완성전달일처럼 미리 준비가 필요한 일정은 하루 전날에도 한 번 더 알려준다
const REMINDER_AHEAD_TYPES = new Set(["custom", "finalDelivery"]);

/** 서버가 UTC로 돌아도 날짜를 한국 시간(KST) 기준으로 계산 */
function kstDateString(offsetDays = 0): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function formatEventLine(e: {
  type: string;
  label: string;
  isMeeting?: boolean;
  time?: string | null;
  timeUnknown?: boolean;
}): string {
  const base = `${EVENT_TYPE_LABELS[e.type] || e.type} · ${e.label}`;
  if (!e.isMeeting) return `• ${base}`;
  if (e.timeUnknown) return `• ${base} (시간 미정)`;
  if (e.time) return `• ${base} (${e.time})`;
  return `• ${base}`;
}

/** 매일 아침 각 유저에게 오늘의 일정 + 완료되지 않은 할 일을 요약해서 알림으로 보낸다 */
export async function sendDailyTodoSummaries() {
  const users = await db.listUsers();
  const today = kstDateString(0);
  const tomorrow = kstDateString(1);
  let usersNotified = 0;

  for (const user of users) {
    const [todos, events] = await Promise.all([
      db.listTodos(user.id),
      db.getCalendarEvents(user.id),
    ]);
    const incomplete = todos.filter((t) => !t.completed);
    const todayEvents = events.filter((e) => e.date === today);
    const tomorrowReminders = events.filter(
      (e) => e.date === tomorrow && REMINDER_AHEAD_TYPES.has(e.type)
    );

    const sections: string[] = [];

    if (todayEvents.length > 0) {
      const lines = todayEvents.slice(0, MAX_ITEMS_IN_BODY).map(formatEventLine);
      if (todayEvents.length > MAX_ITEMS_IN_BODY) {
        lines.push(`외 ${todayEvents.length - MAX_ITEMS_IN_BODY}건`);
      }
      sections.push(["[오늘 일정]", ...lines].join("\n"));
    }

    if (incomplete.length > 0) {
      const lines = incomplete.slice(0, MAX_ITEMS_IN_BODY).map((t) => `• ${t.content}`);
      if (incomplete.length > MAX_ITEMS_IN_BODY) {
        lines.push(`외 ${incomplete.length - MAX_ITEMS_IN_BODY}개`);
      }
      sections.push(["[할 일]", ...lines].join("\n"));
    }

    if (tomorrowReminders.length > 0) {
      const lines = tomorrowReminders.slice(0, MAX_ITEMS_IN_BODY).map(formatEventLine);
      if (tomorrowReminders.length > MAX_ITEMS_IN_BODY) {
        lines.push(`외 ${tomorrowReminders.length - MAX_ITEMS_IN_BODY}건`);
      }
      sections.push(["[내일 미리 알림]", ...lines].join("\n"));
    }

    const title =
      sections.length > 0
        ? `오늘 일정 ${todayEvents.length}건 · 할 일 ${incomplete.length}개`
        : "오늘의 할 일";
    const body =
      sections.length > 0
        ? sections.join("\n\n")
        : "오늘은 일정도, 남은 할 일도 없어요. 편안한 하루 보내세요!";

    await notifyUser(user.id, { title, body, url: "/" });
    usersNotified++;
  }

  return { usersNotified };
}
