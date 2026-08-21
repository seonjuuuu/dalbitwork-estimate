import { useState } from 'react';
import { useLocation } from 'wouter';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useEstimate } from '@/contexts/EstimateContext';

interface Consultation {
  id: number;
  date: string;
  content: string;
}

interface AIEstimateDraftDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  consultations?: Consultation[];
}

export default function AIEstimateDraftDialog({
  isOpen,
  onClose,
  clientName,
  contactName,
  contactPhone,
  contactEmail,
  consultations = [],
}: AIEstimateDraftDialogProps) {
  const [, navigate] = useLocation();
  const { loadDraft } = useEstimate();
  const [inquiryText, setInquiryText] = useState('');
  const [docType, setDocType] = useState<'proposal' | 'estimate'>('proposal');
  const [selectedConsultationId, setSelectedConsultationId] = useState<string>('');

  const draftMutation = trpc.ai.draftEstimate.useMutation();

  const handleSelectConsultation = (value: string) => {
    setSelectedConsultationId(value);
    const found = consultations.find(c => String(c.id) === value);
    if (found) setInquiryText(found.content);
  };

  const handleGenerate = async () => {
    if (!inquiryText.trim()) {
      toast.error('문의 내용을 입력해주세요.');
      return;
    }
    try {
      const draft = await draftMutation.mutateAsync({ inquiryText, docType });
      loadDraft({
        type: docType,
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
      onClose();
      navigate('/editor');
    } catch {
      toast.error('AI 초안 생성에 실패했습니다.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            AI 초안 생성
          </DialogTitle>
          <DialogDescription>
            고객 문의 내용을 붙여넣으면 AI가 등록된 서비스 품목표를 기반으로 초안을 만들어줍니다. 생성된 초안은 저장 전에 검토·수정할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>초안 종류</Label>
            <Select value={docType} onValueChange={v => setDocType(v as 'proposal' | 'estimate')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proposal">제안서</SelectItem>
                <SelectItem value="estimate">견적 및 계약서</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {consultations.length > 0 && (
            <div className="space-y-2">
              <Label>기존 상담 내용 불러오기 (선택)</Label>
              <Select value={selectedConsultationId} onValueChange={handleSelectConsultation}>
                <SelectTrigger>
                  <SelectValue placeholder="상담 이력에서 선택..." />
                </SelectTrigger>
                <SelectContent>
                  {consultations.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.date} — {c.content.slice(0, 30)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>문의 내용 *</Label>
            <Textarea
              value={inquiryText}
              onChange={e => setInquiryText(e.target.value)}
              rows={8}
              placeholder="고객에게 받은 문의 내용을 그대로 붙여넣으세요. (예: 카톡/이메일 원문, 상담 메모 등)"
              className="resize-y min-h-[160px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={draftMutation.isPending}>취소</Button>
          <Button onClick={handleGenerate} disabled={draftMutation.isPending} className="gap-2">
            {draftMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI 초안 생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
