import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Eye, Loader2, MessageSquareText, Send } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface EmailComposeFieldsProps {
  clientId: number;
  clientEmail?: string;
  clientPhone?: string;
  initialSubject: string;
  initialMessage: string;
  onRegenerate: () => void;
  isRegenerating: boolean;
  onSent?: () => void;
}

export default function EmailComposeFields({
  clientId,
  clientEmail,
  clientPhone,
  initialSubject,
  initialMessage,
  onRegenerate,
  isRegenerating,
  onSent,
}: EmailComposeFieldsProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState(initialMessage);
  const [to, setTo] = useState(clientEmail || '');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const sendMutation = trpc.clientEmails.send.useMutation();
  const logManualMutation = trpc.clientEmails.logManualSend.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    setSubject(initialSubject);
    setMessage(initialMessage);
  }, [initialSubject, initialMessage]);

  useEffect(() => {
    setTo(clientEmail || '');
  }, [clientEmail]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    toast.success('메시지를 복사했어요.');
  };

  const handlePreview = async () => {
    setIsPreviewLoading(true);
    try {
      const data = await utils.clientEmails.preview.fetch({ body: message });
      setPreviewHtml(data.html);
    } catch {
      toast.error('미리보기를 불러오지 못했습니다.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error('받는 사람 이메일을 입력해주세요.');
      return;
    }
    try {
      await sendMutation.mutateAsync({ clientId, to: to.trim(), subject: subject.trim(), body: message });
      toast.success('이메일을 보냈어요.');
      onSent?.();
    } catch {
      toast.error('발송에 실패했습니다. Gmail 연동 설정을 확인해주세요.');
    }
  };

  const handleMarkSmsSent = async () => {
    try {
      await logManualMutation.mutateAsync({ clientId, to: clientPhone, subject: subject.trim(), body: message });
      toast.success('문자 발송완료로 기록했어요.');
      onSent?.();
    } catch {
      toast.error('기록에 실패했습니다.');
    }
  };

  return (
    <>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">고객에게 보낼 메시지</p>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={10}
            className="resize-y min-h-[200px] text-sm"
          />
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">이메일로 보내기</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreview}
              disabled={isPreviewLoading}
              className="gap-1.5 h-7 text-xs"
            >
              {isPreviewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              미리보기
            </Button>
          </div>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="받는 사람 이메일"
            type="email"
          />
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="제목"
          />
        </div>
      </div>

      <DialogFooter className="gap-2 flex-wrap">
        <Button variant="outline" onClick={onRegenerate} disabled={isRegenerating}>
          다시 만들기
        </Button>
        <Button variant="outline" onClick={handleCopy} className="gap-2">
          <Copy className="w-4 h-4" />
          메시지 복사
        </Button>
        <Button variant="outline" onClick={handleMarkSmsSent} disabled={logManualMutation.isPending} className="gap-2">
          {logManualMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquareText className="w-4 h-4" />}
          문자 발송완료 기록
        </Button>
        <Button onClick={handleSend} disabled={sendMutation.isPending} className="gap-2">
          {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          이메일 보내기
        </Button>
      </DialogFooter>

      <Dialog open={!!previewHtml} onOpenChange={(open) => !open && setPreviewHtml(null)}>
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>이메일 미리보기</DialogTitle>
            <DialogDescription>실제 발송되는 이메일 화면입니다 (제목: {subject})</DialogDescription>
          </DialogHeader>
          {previewHtml && (
            <iframe
              title="이메일 미리보기"
              srcDoc={previewHtml}
              className="w-full h-[420px] border border-border rounded-md bg-white"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
