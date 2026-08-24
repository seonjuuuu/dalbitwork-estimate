/** TinyURL 레거시 API로 URL을 단축한다 — 가입/API키 불필요한 무료 서비스.
 *  (is.gd는 vercel.app 도메인을 스팸 방지 차원에서 차단해서 사용 불가, TinyURL은 정상 동작 확인함)
 *  실패하면 null (호출부에서 원본 링크로 대체) */
export async function shortenUrl(longUrl: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`
    );
    const text = (await res.text()).trim();
    if (!res.ok || !text.startsWith("http")) {
      console.error("[shortener] tinyurl failed:", text);
      return null;
    }
    return text;
  } catch (err) {
    console.error("[shortener] request failed", err);
    return null;
  }
}
