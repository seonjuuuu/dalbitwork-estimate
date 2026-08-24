import { ENV } from "./_core/env";

/** Bitly API로 URL을 단축한다 — 인증된 정식 API라 광고 리다이렉트나 경고 페이지 없이 바로 연결됨.
 *  (무료 익명 서비스들은 다 문제가 있었음: is.gd는 vercel.app 도메인 차단,
 *   TinyURL 무료 API는 광고 리다이렉트(viglink.com) 경유, da.gd는 신규 링크에 피싱 경고 페이지 표시)
 *  토큰 없거나 실패하면 null (호출부에서 원본 링크로 대체) */
export async function shortenUrl(longUrl: string): Promise<string | null> {
  if (!ENV.bitlyAccessToken) return null;
  try {
    const res = await fetch("https://api-ssl.bitly.com/v4/shorten", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.bitlyAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ long_url: longUrl }),
    });
    const data = await res.json();
    if (!res.ok || !data.link) {
      console.error("[shortener] bitly failed:", data);
      return null;
    }
    return data.link as string;
  } catch (err) {
    console.error("[shortener] request failed", err);
    return null;
  }
}
