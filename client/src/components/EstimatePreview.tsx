import { Download, Eye, ExternalLink, Loader2, Save, PenLine, Copy, CheckCircle2 } from 'lucide-react';
import { useCallback, useState, useRef, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import PdfDocument from './PdfDocument';
import { getDocTypeLabel } from '@/lib/types';
import { useEstimate } from '@/contexts/EstimateContext';
import { useIsMobile } from '@/hooks/useMobile';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function EstimatePreview() {
  const { currentDoc, setCurrentDoc, saveDocument, isSaving } = useEstimate();
  const isMobile = useIsMobile();
  const [isRendering, setIsRendering] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBlobUrlRef = useRef<string | null>(null);
  const createSignLinkMutation = trpc.documents.createSignLink.useMutation();

  const docLabel = getDocTypeLabel(currentDoc.type);

  const handleSave = async () => {
    try {
      await saveDocument();
      toast.success(`${docLabel}가 저장되었습니다.`);
    } catch (err) {
      toast.error('저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('서명 요청 링크를 복사했어요.');
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

  const handleCreateSignLink = async () => {
    if (!currentDoc.id) {
      toast.error('먼저 저장한 후에 서명 요청 링크를 만들 수 있어요.');
      return;
    }
    try {
      const { token, link } = await createSignLinkMutation.mutateAsync({ id: parseInt(currentDoc.id) });
      setCurrentDoc((prev) => ({ ...prev, signToken: token, signedAt: null, signerName: null, signatureDataUrl: null }));
      await copyToClipboard(link);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '링크 생성에 실패했습니다.');
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
        <div className="flex gap-2 flex-wrap justify-end">
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
          {currentDoc.signedAt ? (
            <Button variant="outline" className="gap-2 text-emerald-600 border-emerald-300" disabled>
              <CheckCircle2 className="w-4 h-4" />
              {currentDoc.signerName}님 서명 완료
            </Button>
          ) : currentDoc.signToken ? (
            <Button
              variant="outline"
              onClick={handleCreateSignLink}
              disabled={createSignLinkMutation.isPending}
              className="gap-2"
            >
              {createSignLinkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              서명 링크 다시 복사
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleCreateSignLink}
              disabled={createSignLinkMutation.isPending}
              className="gap-2"
            >
              {createSignLinkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
              서명 요청 링크 생성
            </Button>
          )}
        </div>
      </div>

      {currentDoc.signedAt && currentDoc.signatureDataUrl && (
        <div className="border border-border rounded-lg p-4 bg-muted/20 flex items-center gap-4">
          <img src={currentDoc.signatureDataUrl} alt="서명" className="h-16 bg-white border border-border rounded" />
          <div className="text-sm text-muted-foreground">
            <p className="text-foreground font-medium">{currentDoc.signerName}</p>
            <p>{new Date(currentDoc.signedAt).toLocaleString('ko-KR')}</p>
          </div>
        </div>
      )}

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

        {/* 모바일: iframe 안에서 PDF가 안 뜨는 브라우저(특히 iOS 사파리)가 많아서, 새 탭으로 열도록 안내 */}
        {pdfBlobUrl && isMobile && (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: '#ffffff',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '13px', color: '#888' }}>
              모바일 브라우저는 미리보기를 화면 안에 바로 띄우지 못해서,<br />새 탭에서 열어서 확인해주세요.
            </span>
            <Button onClick={() => window.open(pdfBlobUrl, '_blank')} className="gap-2">
              <ExternalLink className="w-4 h-4" />
              새 탭에서 미리보기 열기
            </Button>
          </div>
        )}

        {/* PDF iframe (데스크톱) */}
        {pdfBlobUrl && !isMobile && (
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

