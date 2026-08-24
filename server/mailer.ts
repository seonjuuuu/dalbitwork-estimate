import nodemailer from "nodemailer";
import { ENV } from "./_core/env";

const transporters = new Map<string, ReturnType<typeof nodemailer.createTransport>>();

function getTransporterFor(user: string, appPassword: string) {
  if (!user || !appPassword) {
    throw new Error(`${user || "Gmail"} 계정의 앱 비밀번호가 설정되지 않았습니다. .env를 확인해주세요.`);
  }
  let t = transporters.get(user);
  if (!t) {
    t = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass: appPassword },
    });
    transporters.set(user, t);
  }
  return t;
}

export const APP_BASE_URL = "https://dalbitwork-estimate-5zcu.vercel.app";
// 고객에게 보내는 질문폼 링크 전용 도메인 — 어드민 주소와 완전히 분리된 별도 Vercel 프로젝트
export const PUBLIC_FORM_BASE_URL = "https://dalbitwork-form-three.vercel.app";

const SIGNATURE_TEXT = `문선주 | WEB Site Developer
M 010-2757-9116
E dalbit.work@gmail.com`;

const SIGNATURE_HTML = `
<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; margin-top: 28px;">
  <tr>
    <td style="vertical-align: top; text-align: center; padding-right: 22px;">
      <img src="${APP_BASE_URL}/logo-symbol.png" width="80" height="80" style="display: block; margin: 0 auto 8px;" alt="달빛워크" />
      <div style="font-size: 17px; font-weight: 800; letter-spacing: 0.3px; white-space: nowrap;">
        <span style="color: #F7AE00;">DAL</span><span style="color: #111111;">BIT WORK</span>
      </div>
    </td>
    <td style="border-left: 1px solid #cccccc; padding-left: 22px; vertical-align: middle;">
      <div style="font-size: 15px; font-weight: 700; color: #111111;">문선주</div>
      <div style="font-size: 13px; color: #555555; margin-top: 2px;">WEB Site Developer</div>
      <div style="height: 14px; line-height: 14px;">&nbsp;</div>
      <div style="font-size: 13px; color: #333333;"><b>M</b>&nbsp; 010-2757-9116</div>
      <div style="font-size: 13px; color: #333333;"><b>E</b>&nbsp; <a href="mailto:dalbit.work@gmail.com" style="color: #1155cc; text-decoration: underline;">dalbit.work@gmail.com</a></div>
    </td>
  </tr>
</table>`;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 실제 발송되는 이메일 HTML(본문 + 서명)을 그대로 생성 — 발송과 미리보기가 항상 같은 결과를 보도록 공유 */
export function buildEmailHtml(bodyText: string): string {
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #1a1a1a; white-space: pre-line; line-height: 1.6;">${escapeHtml(bodyText)}</div>${SIGNATURE_HTML}`;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export async function sendMail(to: string, subject: string, bodyText: string, attachments?: MailAttachment[]) {
  await getTransporterFor(ENV.gmailUser, ENV.gmailAppPassword).sendMail({
    from: `"달빛워크" <${ENV.gmailUser}>`,
    to,
    subject,
    text: `${bodyText}\n\n${SIGNATURE_TEXT}`,
    html: buildEmailHtml(bodyText),
    attachments,
  });
}

// HKTB(홍콩관광청) 앞으로 보내는 메일은 인보이스 PDF에 적힌 연락처(m.seonjuuu@gmail.com)와
// 계정을 맞추기 위해 별도 Gmail 계정으로 발송한다.
const HKTB_SIGNATURE_TEXT = `DalBit Work
Tel: +82 10-8985-3954
E-mail: m.seonjuuu@gmail.com`;

export async function sendHktbMail(to: string, subject: string, bodyText: string, attachments?: MailAttachment[]) {
  await getTransporterFor(ENV.hktbGmailUser, ENV.hktbGmailAppPassword).sendMail({
    from: `"DalBit Work" <${ENV.hktbGmailUser}>`,
    to,
    subject,
    text: `${bodyText}\n\n${HKTB_SIGNATURE_TEXT}`,
    html: `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #1a1a1a; white-space: pre-line; line-height: 1.6;">${escapeHtml(bodyText)}</div><p style="margin-top: 24px; font-family: Arial, sans-serif; font-size: 13px; color: #333;">${escapeHtml(HKTB_SIGNATURE_TEXT).replace(/\n/g, "<br/>")}</p>`,
    attachments,
  });
}
