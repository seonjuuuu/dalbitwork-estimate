import "dotenv/config";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { ENV } from "./_core/env";
import { sendDailyTodoSummaries } from "./cron";

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
app.get("/api/cron/daily-todo-summary", async (req, res) => {
  if (ENV.cronSecret && req.headers.authorization !== `Bearer ${ENV.cronSecret}`) {
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

export default app;
