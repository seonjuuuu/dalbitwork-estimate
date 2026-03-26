import { Download, Eye, Loader2, Save } from 'lucide-react';
import { useCallback, useState, useRef, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import PdfDocument from './PdfDocument';
import { getDocTypeLabel } from '@/lib/types';
import { useEstimate } from '@/contexts/EstimateContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function EstimatePreview() {
  const { currentDoc, saveDocument, isSaving } = useEstimate();
  const [isRendering, setIsRendering] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBlobUrlRef = useRef<string | null>(null);

  const docLabel = getDocTypeLabel(currentDoc.type);

  const handleSave = async () => {
    try {
      await saveDocument();
      toast.success(`${docLabel}가 저장되었습니다.`);
    } catch (err) {
      toast.error('저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // PDF blob 생성 및 iframe 미리보기 갱신
  const renderPreview = useCallback(async () => {
    setIsRendering(true);
    try {
      const blob = await pdf(<PdfDocument doc={currentDoc} />).toBlob();
      const url = URL.createObjectURL(blob);

      // 이전 URL 해제
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
      }
      prevBlobUrlRef.current = url;
      setPdfBlobUrl(url);
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
    }, 600);

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [renderPreview]);

  // cleanup
  useEffect(() => {
    return () => {
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
      }
    };
  }, []);

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
          {isRendering && (
            <Loader2 className="w-3 h-3 animate-spin ml-1" />
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? '저장 중...' : '저장하기'}
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? '생성 중...' : 'PDF 다운로드'}
          </Button>
        </div>
      </div>

      {/* Preview Container - iframe으로 PDF 직접 표시 */}
      <div
        style={{
          background: '#e8e8e4',
          borderRadius: '8px',
          padding: '16px',
          overflow: 'hidden',
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* 로딩 오버레이 */}
        {isRendering && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(232,232,228,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 10,
            borderRadius: '8px',
          }}>
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#F7AE00' }} />
            <span style={{ fontSize: '12px', color: '#888' }}>미리보기 생성 중...</span>
          </div>
        )}

        {/* 초기 로딩 전 플레이스홀더 */}
        {!pdfBlobUrl && !isRendering && (
          <div style={{
            width: '100%',
            height: '100%',
            background: '#ffffff',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: '13px', color: '#aaa' }}>미리보기 준비 중...</span>
          </div>
        )}

        {/* PDF iframe */}
        {pdfBlobUrl && (
          <iframe
            key={pdfBlobUrl}
            src={pdfBlobUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: '4px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            }}
            title="PDF 미리보기"
          />
        )}
      </div>
    </div>
  );
}

