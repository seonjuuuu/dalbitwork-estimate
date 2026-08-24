import "dotenv/config";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { ENV } from "./_core/env";
import { sendDailyTodoSummaries } from "./cron";
import * as db from "./db";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Vercel Cron이 매일 아침 8시(KST)에 호출 — 할 일 요약 알림 발송
// CRON_SECRET이 설정 안 된 배포(예: 고객용으로 별도 연결한 프로젝트)에서는 항상 거부해서
// 같은 vercel.json을 공유하는 다른 프로젝트에서 중복으로 알림이 발송되는 걸 막는다.
app.get("/api/cron/daily-todo-summary", async (req, res) => {
  if (!ENV.cronSecret || req.headers.authorization !== `Bearer ${ENV.cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await sendDailyTodoSummaries();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[cron] daily-todo-summary failed", err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

// 고객에게 보내는 질문폼 링크(/f/:token) — 카카오톡/메신저 미리보기 카드가 "달빛워크 견적서"로 뜨지 않도록
// 정적 index.html에 이 링크 전용 title/OG 태그를 심어서 내려준다.
app.get("/f/:token", async (req, res) => {
  try {
    const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
    const host = req.headers.host;
    const htmlRes = await fetch(`${protocol}://${host}/index.html`);
    let html = await htmlRes.text();

    const form = await db.getIntakeFormByToken(req.params.token);
    const title = escapeHtml(
      form?.clientName ? `${form.clientName} | 달빛워크 홈페이지 기획 질문폼` : "달빛워크 홈페이지 기획 질문폼"
    );
    const description = escapeHtml("달빛워크에서 보내드린 홈페이지 제작 질문폼입니다. 아래 질문에 답변해 주세요.");

    html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    html = html.replace(
      "</head>",
      `<meta property="og:title" content="${title}" />\n<meta property="og:description" content="${description}" />\n<meta property="og:type" content="website" />\n</head>`
    );

    res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).send(html);
  } catch (err) {
    console.error("[form-preview] failed", err);
    res
      .status(200)
      .set({ "Content-Type": "text/html; charset=utf-8" })
      .send(`<!doctype html><html><head><meta charset="utf-8"><title>달빛워크</title></head><body><p>페이지를 불러오지 못했습니다. <a href="${req.originalUrl}">새로고침</a></p></body></html>`);
  }
});

export default app;
