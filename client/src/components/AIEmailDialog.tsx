import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import EmailComposeFields from './EmailComposeFields';

interface AIEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
  clientEmail?: string;
  clientPhone?: string;
}

const DEFAULT_SUBJECT = '[달빛워크] 안내드립니다';

export default function AIEmailDialog({
  isOpen,
  onClose,
  clientId,
  clientEmail,
  clientPhone,
}: AIEmailDialogProps) {
  const [purpose, setPurpose] = useState('');
  const [draft, setDraft] = useState<{ subject: string; message: string } | null>(null);
  const generateMutation = trpc.ai.generateEmailDraft.useMutation();

  const handleGenerate = async () => {
    if (!purpose.trim()) {
      toast.error('메일을 보내는 목적을 입력해주세요.');
      return;
    }
    try {
      const data = await generateMutation.mutateAsync({ clientId, purpose: purpose.trim() });
      setDraft(data);
    } catch {
      toast.error('초안 생성에 실패했습니다.');
    }
  };

  const handleClose = () => {
    setPurpose('');
    setDraft(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            AI 메일 작성
          </DialogTitle>
          <DialogDescription>
            어떤 목적으로 메일을 보내는지 입력하면, AI가 제목과 본문 초안을 만들어드려요.
          </DialogDescription>
        </DialogHeader>

        {!draft ? (
          <>
            <div className="space-y-2 py-2">
              <p className="text-sm font-semibold text-foreground">메일을 보내는 목적</p>
              <Textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={5}
                placeholder="예: 계약금 입금 확인 요청, 미팅 일정 조율, 작업 완료 안내 등"
                className="resize-y min-h-[100px] text-sm"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} disabled={generateMutation.isPending}>취소</Button>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2">
                {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                초안 생성
              </Button>
            </DialogFooter>
          </>
        ) : (
          <EmailComposeFields
            clientId={clientId}
            clientEmail={clientEmail}
            clientPhone={clientPhone}
            initialSubject={draft.subject || DEFAULT_SUBJECT}
            initialMessage={draft.message}
            onRegenerate={() => setDraft(null)}
            isRegenerating={generateMutation.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
