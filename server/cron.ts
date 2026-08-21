import * as db from "./db";
import { notifyUser } from "./push";

const MAX_ITEMS_IN_BODY = 6;

/** 매일 아침 각 유저에게 완료되지 않은 할 일 목록을 요약해서 알림으로 보낸다 */
export async function sendDailyTodoSummaries() {
  const users = await db.listUsers();
  let usersNotified = 0;

  for (const user of users) {
    const todos = await db.listTodos(user.id);
    const incomplete = todos.filter((t) => !t.completed);

    const title = incomplete.length > 0 ? `오늘의 할 일 (${incomplete.length}개)` : "오늘의 할 일";
    const body =
      incomplete.length > 0
        ? incomplete
            .slice(0, MAX_ITEMS_IN_BODY)
            .map((t) => `• ${t.content}`)
            .join("\n") +
          (incomplete.length > MAX_ITEMS_IN_BODY ? `\n외 ${incomplete.length - MAX_ITEMS_IN_BODY}개` : "")
        : "오늘은 남은 할 일이 없어요. 편안한 하루 보내세요!";

    await notifyUser(user.id, { title, body, url: "/" });
    usersNotified++;
  }

  return { usersNotified };
}
