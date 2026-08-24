import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Copy, MessageSquareText, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface AISmsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
  clientPhone?: string;
}

export default function AISmsDialog({ isOpen, onClose, clientId, clientPhone }: AISmsDialogProps) {
  const [purpose, setPurpose] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const generateMutation = trpc.ai.generateSmsDraft.useMutation();
  const logManualMutation = trpc.clientEmails.logManualSend.useMutation();

  useEffect(() => {
    if (!isOpen) {
      setPurpose('');
      setMessage(null);
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    if (!purpose.trim()) {
      toast.error('문자를 보내는 목적을 입력해주세요.');
      return;
    }
    try {
      const data = await generateMutation.mutateAsync({ clientId, purpose: purpose.trim() });
      setMessage(data.message);
    } catch {
      toast.error('초안 생성에 실패했습니다.');
    }
  };

  const handleCopy = async () => {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    toast.success('메시지를 복사했어요.');
  };

  const handleMarkSent = async () => {
    if (!message) return;
    try {
      await logManualMutation.mutateAsync({ clientId, to: clientPhone, subject: '', body: message });
      toast.success('문자 발송완료로 기록했어요.');
    } catch {
      toast.error('기록에 실패했습니다.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            AI 문자 작성
          </DialogTitle>
          <DialogDescription>
            어떤 목적으로 문자를 보내는지 입력하면, 이메일보다 짧고 친근한 말투로 초안을 만들어드려요.
          </DialogDescription>
        </DialogHeader>

        {message === null ? (
          <>
            <div className="space-y-2 py-2">
              <p className="text-sm font-semibold text-foreground">문자를 보내는 목적</p>
              <Textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={4}
                placeholder="예: 방문 시간 확인, 촬영 일정 리마인드 등"
                className="resize-y min-h-[90px] text-sm"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose} disabled={generateMutation.isPending}>취소</Button>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2">
                {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                초안 생성
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-2 py-2">
              <p className="text-sm font-semibold text-foreground">문자 메시지</p>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="resize-y min-h-[120px] text-sm"
              />
            </div>
            <DialogFooter className="gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setMessage(null)} disabled={generateMutation.isPending}>
                다시 만들기
              </Button>
              <Button variant="outline" onClick={handleCopy} className="gap-2">
                <Copy className="w-4 h-4" />
                메시지 복사
              </Button>
              <Button onClick={handleMarkSent} disabled={logManualMutation.isPending} className="gap-2">
                {logManualMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquareText className="w-4 h-4" />}
                문자 발송완료 기록
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
