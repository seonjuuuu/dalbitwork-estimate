import nodemailer from "nodemailer";
import { ENV } from "./_core/env";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter) {
    if (!ENV.gmailUser || !ENV.gmailAppPassword) {
      throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD가 설정되지 않았습니다. .env를 확인해주세요.");
    }
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: ENV.gmailUser, pass: ENV.gmailAppPassword },
    });
  }
  return transporter;
}

export async function sendMail(to: string, subject: string, text: string) {
  await getTransporter().sendMail({
    from: `"달빛워크" <${ENV.gmailUser}>`,
    to,
    subject,
    text,
  });
}
