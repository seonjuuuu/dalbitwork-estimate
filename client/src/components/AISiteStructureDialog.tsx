import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, Save, ListTree, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface Consultation {
  id: number;
  date: string;
  content: string;
}

export interface SiteStructureResult {
  menuStructure: { label: string; subItems: string[] }[];
  questions: string[];
  summary: string;
}

interface AISiteStructureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
  consultations?: Consultation[];
}

export default function AISiteStructureDialog({
  isOpen,
  onClose,
  clientId,
  consultations = [],
}: AISiteStructureDialogProps) {
  const utils = trpc.useUtils();
  const [consultationText, setConsultationText] = useState('');
  const [selectedConsultationId, setSelectedConsultationId] = useState<string>('');
  const [result, setResult] = useState<SiteStructureResult | null>(null);

  const generateMutation = trpc.ai.generateSiteStructure.useMutation();
  const saveMutation = trpc.clients.addSiteStructure.useMutation();

  const handleSelectConsultation = (value: string) => {
    setSelectedConsultationId(value);
    const found = consultations.find(c => String(c.id) === value);
    if (found) setConsultationText(found.content);
  };

  const handleGenerate = async () => {
    if (!consultationText.trim()) {
      toast.error('상담 내용을 입력해주세요.');
      return;
    }
    try {
      const data = await generateMutation.mutateAsync({ clientId, consultationText });
      setResult(data);
    } catch {
      toast.error('구성안 생성에 실패했습니다.');
    }
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      await saveMutation.mutateAsync({ id: clientId, entry: result });
      await utils.clients.get.invalidate({ id: clientId });
      toast.success('구성안이 이력에 추가되었습니다.');
      handleClose();
    } catch {
      toast.error('구성안 저장에 실패했습니다.');
    }
  };

  const handleClose = () => {
    setResult(null);
    setConsultationText('');
    setSelectedConsultationId('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTree className="w-4 h-4 text-primary" />
            AI 홈페이지 구성안 생성
          </DialogTitle>
          <DialogDescription>
            상담 내용을 바탕으로 대략적인 메뉴 구성과, 확정 전에 고객에게 확인해야 할 질문 목록을 뽑아줍니다.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="space-y-4 py-2">
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
                <Label>상담 내용 *</Label>
                <Textarea
                  value={consultationText}
                  onChange={e => setConsultationText(e.target.value)}
                  rows={8}
                  placeholder="고객과 나눈 상담 내용을 붙여넣으세요. (업종, 원하는 기능, 참고 사이트 등이 포함될수록 좋습니다)"
                  className="resize-y min-h-[160px]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} disabled={generateMutation.isPending}>취소</Button>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2">
                {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                구성안 생성
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-5 py-2">
              {result.summary && (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">{result.summary}</p>
              )}

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-semibold">
                  <ListTree className="w-3.5 h-3.5" />
                  메뉴 구성
                </Label>
                <div className="space-y-2 border border-border rounded-lg p-3">
                  {result.menuStructure.map((m, idx) => (
                    <div key={idx}>
                      <p className="text-sm font-medium text-foreground">{m.label}</p>
                      {m.subItems.length > 0 && (
                        <ul className="mt-1 ml-3 space-y-0.5">
                          {m.subItems.map((s, sIdx) => (
                            <li key={sIdx} className="text-xs text-muted-foreground">· {s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-semibold">
                  <HelpCircle className="w-3.5 h-3.5" />
                  고객에게 확인할 사항
                </Label>
                <ul className="space-y-1 border border-border rounded-lg p-3">
                  {result.questions.length > 0 ? result.questions.map((q, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground">- {q}</li>
                  )) : (
                    <li className="text-xs text-muted-foreground/60">확인이 필요한 사항이 없습니다.</li>
                  )}
                </ul>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setResult(null)} disabled={saveMutation.isPending}>
                다시 만들기
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                이력에 추가
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
