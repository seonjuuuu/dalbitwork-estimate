import type { Express, Request, Response } from "express";
import { z } from "zod";
import * as db from "./db";
import { sendMail } from "./mailer";
import { notifyUser } from "./push";
import { ENV } from "./_core/env";

/** 마케팅 사이트(dalbit-work.co.kr)에서 오는 상담 신청 요청만 허용 */
const ALLOWED_ORIGINS = new Set([
  "https://dalbit-work.co.kr",
  "https://www.dalbit-work.co.kr",
  "http://localhost:3002",
  "http://localhost:5173",
]);

const consultationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  company: z.string().trim().max(200).optional().default(""),
  contact: z.string().trim().min(1).max(50),
  service: z.string().trim().min(1).max(100),
  budget: z.string().trim().max(100).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
});

function applyCors(req: Request, res: Response) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/** 홈페이지 상담 신청 폼 → 홈페이지 상담폼 인박스에 저장 + 관리자 알림(사이트 기록) + 이메일 발송 */
export function registerPublicConsultationRoute(app: Express) {
  app.options("/api/public/consultations", (req, res) => {
    applyCors(req, res);
    res.sendStatus(204);
  });

  app.post("/api/public/consultations", async (req, res) => {
    applyCors(req, res);

    const parsed = consultationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "입력값을 확인해주세요." });
      return;
    }
    const { name, company, contact, service, budget, message } = parsed.data;

    try {
      const owners = await db.listUsers();
      const owner = owners[0];
      if (!owner) {
        res.status(500).json({ success: false, error: "관리자 계정을 찾을 수 없습니다." });
        return;
      }

      await db.createHomepageConsultation({
        userId: owner.id,
        name,
        company,
        contact,
        service,
        budget,
        message,
      });

      await notifyUser(owner.id, {
        title: "새 상담 신청이 도착했어요",
        body: `${name}님 (${contact}) · ${service}`,
        url: `/homepage-consultations`,
      }).catch(err => console.error("[public-consultation] push failed", err));

      if (ENV.gmailUser) {
        await sendMail(
          ENV.gmailUser,
          `[달빛워크] 새 상담 신청 - ${name}`,
          `이름: ${name}\n회사명: ${company || "(미입력)"}\n연락처: ${contact}\n분야: ${service}\n예산: ${budget || "(미입력)"}\n\n문의 내용\n${message || "(내용 미입력)"}`
        ).catch(err => console.error("[public-consultation] mail failed", err));
      }

      res.json({ success: true });
    } catch (err) {
      console.error("[public-consultation] failed", err);
      res.status(500).json({ success: false, error: "처리 중 오류가 발생했습니다." });
    }
  });
}
