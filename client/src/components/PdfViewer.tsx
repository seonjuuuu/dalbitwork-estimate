import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Loader2 } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorkerUrl;

export default function PdfViewer({ blob }: { blob: Blob | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    setIsRendering(true);
    setError(false);

    (async () => {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.marginBottom = '10px';
          canvas.style.borderRadius = '4px';
          canvas.style.boxShadow = '0 1px 6px rgba(0,0,0,0.15)';
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
          containerRef.current?.appendChild(canvas);
        }
      } catch (err) {
        console.error('PDF 렌더링 오류:', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (!blob) return null;

  return (
    <div className="relative">
      {isRendering && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <p className="text-sm text-muted-foreground text-center py-8">계약서를 불러오지 못했어요.</p>
      )}
      <div ref={containerRef} />
    </div>
  );
}
