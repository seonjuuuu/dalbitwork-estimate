/** da.gd로 URL을 단축한다 — 가입/API키 불필요한 무료 서비스, 광고 리다이렉트 없이 바로 연결됨.
 *  (is.gd는 vercel.app 도메인을 스팸 방지 차원에서 차단해서 사용 불가,
 *   TinyURL 무료 API는 광고 리다이렉트(viglink.com)를 거쳐가서 링크가 이상하게 연결되는 문제가 있어 제외함)
 *  실패하면 null (호출부에서 원본 링크로 대체) */
export async function shortenUrl(longUrl: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://da.gd/shorten?url=${encodeURIComponent(longUrl)}`
    );
    const text = (await res.text()).trim();
    if (!res.ok || !text.startsWith("http")) {
      console.error("[shortener] da.gd failed:", text);
      return null;
    }
    return text;
  } catch (err) {
    console.error("[shortener] request failed", err);
    return null;
  }
}
