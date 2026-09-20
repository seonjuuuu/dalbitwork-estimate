import { useEffect, useRef, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import SignaturePad, { type SignaturePadHandle } from '@/components/SignaturePad';
import PdfDocument from '@/components/PdfDocument';
import PdfViewer from '@/components/PdfViewer';
import type { DocumentData } from '@/lib/types';

const WORDMARK_LOGO_URL = '/logo-full.png';

function todayLabel() {
  return new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PublicSignDocument({ token }: { token: string }) {
  const { data: doc, isLoading, error } = trpc.documents.getByToken.useQuery({ token });
  const submitMutation = trpc.documents.submitSignature.useMutation();
  const signaturePadRef = useRef<SignaturePadHandle>(null);
  const [signerName, setSignerName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    pdf(<PdfDocument doc={doc as unknown as DocumentData} />)
      .toBlob()
      .then((blob) => {
        if (!cancelled) setPdfBlob(blob);
      })
      .catch((err) => console.error('계약서 PDF 생성 오류:', err));
    return () => {
      cancelled = true;
    };
  }, [doc]);

  const handleSubmit = async () => {
    if (!signerName.trim()) {
      toast.error('이름을 입력해주세요.');
      return;
    }
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      toast.error('서명을 그려주세요.');
      return;
    }
    try {
      await submitMutation.mutateAsync({
        token,
        signerName: signerName.trim(),
        signatureDataUrl: signaturePadRef.current.toDataUrl(),
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '제출에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="w-full max-w-lg mx-auto">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src={WORDMARK_LOGO_URL} alt="달빛워크" className="h-10 w-auto object-contain" />
          <h1 className="text-lg font-bold text-foreground">계약서 서명</h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !doc ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">유효하지 않은 링크예요. 보내주신 분께 다시 확인해주세요.</p>
          </div>
        ) : doc.signedAt || submitted ? (
          <div className="text-center py-16 flex flex-col items-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">서명이 완료됐어요. 감사합니다!</p>
            <p className="text-xs text-muted-foreground">확인 후 곧 연락드릴게요.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="border border-border rounded-lg bg-muted/20 p-2">
              <PdfViewer blob={pdfBlob} />
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                위 계약 내용을 확인했으며, 이에 동의하여 서명합니다.
              </p>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">이름</label>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="서명인 이름을 입력해주세요"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">서명</label>
                <SignaturePad ref={signaturePadRef} />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">날짜</label>
                <p className="text-sm text-muted-foreground border border-input rounded-md px-3 py-2 bg-muted/30">
                  {todayLabel()}
                </p>
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                서명 완료하기
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
