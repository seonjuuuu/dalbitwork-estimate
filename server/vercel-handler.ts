import "dotenv/config";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { ENV } from "./_core/env";
import { sendDailyTodoSummaries, checkHktbRetainerReminder } from "./cron";
import * as db from "./db";
import { buildGmailReconnectUrl, completeGmailReconnect } from "./gmailWatcher";

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
    let hktbResult: { created: number } | { error: string } = { created: 0 };
    try {
      hktbResult = await checkHktbRetainerReminder();
    } catch (err) {
      console.error("[cron] hktb-retainer-reminder failed", err);
      hktbResult = { error: String(err) };
    }
    res.json({ success: true, ...result, hktbRetainer: hktbResult });
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

// Gmail 재연결(테스트 모드 refresh token이 7일마다 만료되는 걸 앱 안에서 셀프로 갱신하기 위한 플로우)
// state 파라미터로 어느 유저 것인지 식별 (로그인 세션 헤더가 안 붙는 일반 리디렉션이라 별도 인증 없이 내부 유저 id만 실어보냄)
app.get("/api/gmail-oauth/start", (req, res) => {
  const state = String(req.query.state || "");
  if (!state) {
    res.status(400).send("state(userId) 파라미터가 필요합니다.");
    return;
  }
  const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
  const redirectUri = `${protocol}://${req.headers.host}/api/gmail-oauth/callback`;
  res.redirect(302, buildGmailReconnectUrl(redirectUri, state));
});

app.get("/api/gmail-oauth/callback", async (req, res) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const userId = Number(state);
  if (!code || !userId) {
    res.status(400).send("잘못된 요청입니다.");
    return;
  }
  try {
    const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
    const redirectUri = `${protocol}://${req.headers.host}/api/gmail-oauth/callback`;
    await completeGmailReconnect(code, redirectUri, userId);
    res
      .status(200)
      .set({ "Content-Type": "text/html; charset=utf-8" })
      .send(`<!doctype html><html><head><meta charset="utf-8"><title>연결 완료</title></head><body style="font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><p style="font-size:16px;">✅ Gmail 재연결 완료! 이 창을 닫아주세요.</p></body></html>`);
  } catch (err) {
    console.error("[gmail-oauth] callback failed", err);
    res
      .status(500)
      .set({ "Content-Type": "text/html; charset=utf-8" })
      .send(`<!doctype html><html><head><meta charset="utf-8"><title>연결 실패</title></head><body style="font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><p style="font-size:16px;">❌ 연결에 실패했습니다: ${escapeHtml(String(err))}</p></body></html>`);
  }
});

export default app;
