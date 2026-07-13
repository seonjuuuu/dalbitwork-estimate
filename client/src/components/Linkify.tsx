const URL_SPLIT_REGEX = /(https?:\/\/[^\s]+)/g;

function isUrl(s: string) {
  return /^https?:\/\//.test(s);
}

/** 텍스트 안의 URL을 자동으로 클릭 가능한 링크로 변환. 줄바꿈은 부모의 whitespace-pre-wrap이 처리. */
export default function Linkify({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(URL_SPLIT_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        isUrl(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </>
  );
}
