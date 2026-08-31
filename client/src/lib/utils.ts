import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** IMAP에서 저장해둔 Message-ID로 Gmail 웹에서 해당 메일을 바로 여는 링크를 만든다.
 *  본문은 우리 서버가 아예 가져오지 않으므로, 실제로 열어서 보는 건 항상 Gmail 쪽에서 처리. */
export function buildGmailMessageUrl(messageId: string, gmailUser: string): string | null {
  if (!messageId || messageId.startsWith('uid-')) return null; // Message-ID 헤더가 없던 메일(폴백 키)은 검색 불가
  const stripped = messageId.replace(/^</, '').replace(/>$/, '');
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(gmailUser)}#search/rfc822msgid:${encodeURIComponent(stripped)}`;
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}
