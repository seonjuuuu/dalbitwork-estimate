import { nanoid } from "nanoid";
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
    // 마감일이 오늘인 할 일도 [오늘 일정]에 함께 표시 ([할 일] 섹션에는 항상 전체가 뜸)
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

// HKTB 관리비(Retainer) 청구 주기: 4-5, 6-7, 8-9, 10-11, 12-1, 2-3월 2개월 단위로,
// 해당 구간이 끝난 다음 달 1일에 인보이스를 보내는 형식(예: 4-5월분 → 6월 1일 발송)
const HKTB_RETAINER_DUE_MONTHS = new Set([2, 4, 6, 8, 10, 12]);

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function hktbMonthRange(year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const last = String(lastDayOfMonth(year, month)).padStart(2, "0");
  return { dateFrom: `${year}.${mm}.01`, dateTo: `${year}.${mm}.${last}` };
}

/**
 * 오늘이 HKTB 관리비 인보이스 발송 예정일(짝수월 1일)이면, 해당 2개월치 인보이스 초안을
 * 미리 만들어두고 알림을 보낸다. 실제 이메일 발송은 담당자가 직접 확인 후 버튼으로 진행.
 * 이미 같은 구간의 인보이스가 있으면(수동으로 미리 만들어둔 경우 등) 건너뛴다.
 */
export async function checkHktbRetainerReminder(now: Date = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDate();
  const dueMonth = kst.getUTCMonth() + 1;
  const dueYear = kst.getUTCFullYear();

  if (day !== 1 || !HKTB_RETAINER_DUE_MONTHS.has(dueMonth)) {
    return { created: 0 };
  }

  // 청구 대상 2개월 구간 계산 (예: 6월 1일 발송 → 4~5월분, 2월 1일 발송 → 전년 12월~올해 1월분)
  let m2 = dueMonth - 1;
  let y2 = dueYear;
  if (m2 === 0) {
    m2 = 12;
    y2 -= 1;
  }
  let m1 = m2 - 1;
  let y1 = y2;
  if (m1 === 0) {
    m1 = 12;
    y1 -= 1;
  }

  const range1 = hktbMonthRange(y1, m1);
  const range2 = hktbMonthRange(y2, m2);
  const todayStr = kst.toISOString().slice(0, 10);

  // 4월 1일(2-3월분)은 계약연도의 마지막 청구 주기 — 이 주기가 지나면 다음 주기는
  // 새 계약연도(6월 1일, 4-5월분)이므로, 재계약 여부를 확인하고 자동 알림을 끌 수 있게 안내한다.
  const isLastCycleOfContractYear = dueMonth === 4;

  const users = await db.listUsers();
  let created = 0;

  for (const user of users) {
    if (!user.hktbRetainerAutoEnabled) continue;

    const existing = await db.listHktbInvoices(user.id, "retainer");
    const alreadyExists = existing.some((inv) => {
      const items = inv.items as { dateFrom?: string }[] | null;
      return items?.[0]?.dateFrom === range1.dateFrom;
    });
    if (alreadyExists) continue;

    const monthlyPrice = user.hktbRetainerMonthlyPrice || "850,000";
    const price = parseInt(monthlyPrice.replace(/,/g, ""), 10) || 850000;
    const vat = Math.round(price * 0.1);
    const totalAmount = (price + vat) * 2;

    await db.createHktbInvoice({
      userId: user.id,
      type: "retainer",
      invoiceNo: `${todayStr.replace(/-/g, "")}001A`,
      invoiceDate: todayStr,
      items: [
        { id: nanoid(), dateFrom: range1.dateFrom, dateTo: range1.dateTo, jobDescription: "Retainer Fee", price: monthlyPrice },
        { id: nanoid(), dateFrom: range2.dateFrom, dateTo: range2.dateTo, jobDescription: "Retainer Fee", price: monthlyPrice },
      ],
      totalAmount,
      revenueMonth: `${dueYear}-${String(dueMonth).padStart(2, "0")}`,
    });

    await notifyUser(user.id, {
      title: "HKTB 관리비 인보이스 준비됐어요",
      body: isLastCycleOfContractYear
        ? `${m1}-${m2}월분 인보이스 초안을 만들어뒀어요. 이번이 이번 계약연도의 마지막 주기예요 — 재계약이 안 됐다면 "홍콩관광청 관리용 Invoice" 페이지에서 자동 알림을 꺼주세요.`
        : `${m1}-${m2}월분 인보이스 초안을 만들어뒀어요. 확인 후 이메일로 보내주세요.`,
      url: "/hktb-retainer",
    });
    created++;
  }

  return { created };
}
