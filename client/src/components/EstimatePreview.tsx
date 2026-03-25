import { Button } from '@/components/ui/button';
import { Download, Eye, Loader2 } from 'lucide-react';
import { useCallback, useState, useRef, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import PdfDocument from './PdfDocument';
import { getDocTypeLabel } from '@/lib/types';
import { useEstimate } from '@/contexts/EstimateContext';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function EstimatePreview() {
  const { currentDoc } = useEstimate();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const docLabel = getDocTypeLabel(currentDoc.type);

  // PDF blob 생성 및 페이지 이미지 렌더링
  const renderPreview = useCallback(async () => {
    setIsRendering(true);
    try {
      // @react-pdf/renderer로 PDF blob 생성
      const blob = await pdf(<PdfDocument doc={currentDoc} />).toBlob();
      const url = URL.createObjectURL(blob);
      
      // 이전 URL 해제
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
      setPdfBlobUrl(url);

      // pdfjs로 PDF를 canvas에 렌더링하여 이미지로 변환
      const arrayBuffer = await blob.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdfDoc.numPages;
      const images: string[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const scale = 2; // 고해상도 렌더링
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;

        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;

        images.push(canvas.toDataURL('image/png'));
      }

      setPageImages(images);
    } catch (err) {
      console.error('미리보기 렌더링 오류:', err);
    } finally {
      setIsRendering(false);
    }
  }, [currentDoc]);

  // currentDoc 변경 시 debounce로 미리보기 갱신
  useEffect(() => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }
    renderTimeoutRef.current = setTimeout(() => {
      renderPreview();
    }, 500); // 500ms debounce

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [renderPreview]);

  // cleanup
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  // PDF 다운로드
  const handleDownload = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const blob = await pdf(<PdfDocument doc={currentDoc} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentDoc.clientName || '고객사'}_${docLabel}_달빛워크.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error('PDF 생성 오류:', err);
      alert('PDF 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsDownloading(false);
    }
  }, [currentDoc, docLabel, isDownloading]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Eye className="w-4 h-4" />
          미리보기
          {pageImages.length > 1 && (
            <span style={{ fontSize: '11px', color: '#888', marginLeft: '4px' }}>
              ({pageImages.length}페이지)
            </span>
          )}
          {isRendering && (
            <Loader2 className="w-3 h-3 animate-spin ml-1" />
          )}
        </div>
        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Download className="w-4 h-4" />
          {isDownloading ? '생성 중...' : 'PDF 다운로드'}
        </Button>
      </div>

      {/* Preview Container - 실제 PDF 렌더링 결과를 이미지로 표시 */}
      <div
        ref={canvasContainerRef}
        style={{
          background: '#e8e8e4',
          borderRadius: '8px',
          padding: '24px 16px',
          overflow: 'auto',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        {pageImages.length === 0 && isRendering && (
          <div style={{
            width: '420px',
            height: '594px',
            background: '#ffffff',
            borderRadius: '4px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#F7AE00' }} />
            <span style={{ fontSize: '12px', color: '#888' }}>미리보기 생성 중...</span>
          </div>
        )}

        {pageImages.map((imgSrc, idx) => (
          <div key={idx} style={{ position: 'relative' }}>
            {/* 페이지 번호 표시 */}
            {pageImages.length > 1 && (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'rgba(0,0,0,0.5)',
                color: '#fff',
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                zIndex: 10,
              }}>
                {idx + 1} / {pageImages.length}
              </div>
            )}
            <img
              src={imgSrc}
              alt={`페이지 ${idx + 1}`}
              style={{
                width: '420px',
                height: 'auto',
                boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
                borderRadius: '2px',
                display: 'block',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
