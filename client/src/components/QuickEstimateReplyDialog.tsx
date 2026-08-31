import { useState } from 'react';
import { useLocation } from 'wouter';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Copy, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useEstimate } from '@/contexts/EstimateContext';

interface QuickEstimateReplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export default function QuickEstimateReplyDialog({
  isOpen,
  onClose,
  clientName,
  contactName,
  contactPhone,
  contactEmail,
}: QuickEstimateReplyDialogProps) {
  const [, navigate] = useLocation();
  const { loadDraft } = useEstimate();
  const [inquiryText, setInquiryText] = useState('');
  const [result, setResult] = useState<{ replyText: string; priceRangeLabel: string } | null>(null);

  const replyMutation = trpc.ai.draftQuickReply.useMutation();
  const draftMutation = trpc.ai.draftEstimate.useMutation();

  const handleClose = () => {
    setInquiryText('');
    setResult(null);
    onClose();
  };

  const handleGenerateReply = async () => {
    if (!inquiryText.trim()) {
      toast.error('문의 내용을 입력해주세요.');
      return;
    }
    try {
      const res = await replyMutation.mutateAsync({ inquiryText });
      setResult(res);
    } catch {
      toast.error('답장 생성에 실패했습니다.');
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.replyText);
      toast.success('클립보드에 복사했습니다.');
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

  const handleMakeFormalEstimate = async () => {
    try {
      const draft = await draftMutation.mutateAsync({ inquiryText, docType: 'proposal' });
      loadDraft({
        type: 'proposal',
        clientName,
        contactName,
        contactPhone,
        contactEmail,
        projectName: draft.projectName,
        platform: draft.platform,
        businessType: draft.businessType,
        items: draft.items,
        optionalItems: draft.optionalItems,
        notes: draft.notes,
      });
      toast.success(draft.summary || 'AI 초안이 생성되었습니다. 내용을 검토 후 저장해주세요.');
      handleClose();
      navigate('/editor');
    } catch {
      toast.error('정식 견적서 생성에 실패했습니다.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            빠른 견적 문의 답장
          </DialogTitle>
          <DialogDescription>
            정식 상담 전 고객이 가볍게 "대략 얼마예요?" 물어봤을 때, 서비스 품목표 기준 대략적인 가격대를 담은 답장 문구를 만들어드려요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>문의 내용 *</Label>
            <Textarea
              value={inquiryText}
              onChange={e => setInquiryText(e.target.value)}
              rows={5}
              placeholder="예: 홈페이지 하나 만들려는데 대략 얼마나 해요?"
              className="resize-y min-h-[100px]"
            />
          </div>

          {result && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-primary">{result.priceRangeLabel}</span>
                <Button size="sm" variant="ghost" onClick={handleCopy} className="h-7 text-xs gap-1">
                  <Copy className="w-3 h-3" />복사하기
                </Button>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{result.replyText}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap sm:flex-wrap">
          <Button variant="outline" onClick={handleClose} disabled={replyMutation.isPending || draftMutation.isPending}>
            닫기
          </Button>
          {result && (
            <Button
              variant="outline"
              onClick={handleMakeFormalEstimate}
              disabled={draftMutation.isPending}
              className="gap-2"
            >
              {draftMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              이 내용으로 정식 견적서 만들기
            </Button>
          )}
          <Button onClick={handleGenerateReply} disabled={replyMutation.isPending} className="gap-2">
            {replyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI 답장 생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
