import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Copy, ClipboardCheck, Send, History, Eye, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

export interface ClientRequestChecklistResult {
  subject: string;
  items: { label: string; description: string }[];
  message: string;
}

interface ClientRequestChecklistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
  clientEmail?: string;
  clientPhone?: string;
}

const DEFAULT_SUBJECT = '[달빛워크] 홈페이지 제작 준비자료 안내';

function formatSentAt(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function HistoryItem({ h }: { h: { id: number; sentAt: unknown; channel: string; toAddress: string; subject: string } }) {
  return (
    <li className="text-xs">
      <span
        className={`inline-block px-1 py-0.5 rounded text-[10px] font-medium mr-1 ${
          h.channel === 'sms'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
        }`}
      >
        {h.channel === 'sms' ? '문자' : '이메일'}
      </span>
      <span className="text-muted-foreground">{formatSentAt(String(h.sentAt))}</span>
      {h.toAddress && (
        <>
          {' · '}
          <span className="text-foreground">{h.toAddress}</span>
        </>
      )}
      {h.subject && (
        <>
          {' — '}
          <span className="text-muted-foreground">{h.subject}</span>
        </>
      )}
    </li>
  );
}

export default function ClientRequestChecklistDialog({
  isOpen,
  onClose,
  clientId,
  clientEmail,
  clientPhone,
}: ClientRequestChecklistDialogProps) {
  const [result, setResult] = useState<ClientRequestChecklistResult | null>(null);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [to, setTo] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const generateMutation = trpc.ai.generateClientRequestChecklist.useMutation();
  const sendMutation = trpc.clientEmails.send.useMutation();
  const logManualMutation = trpc.clientEmails.logManualSend.useMutation();
  const utils = trpc.useUtils();
  const { data: history = [], refetch: refetchHistory } = trpc.clientEmails.listByClient.useQuery(
    { clientId },
    { enabled: isOpen }
  );
  const { data: intakeForms = [] } = trpc.forms.listByClient.useQuery({ clientId }, { enabled: isOpen });
  const pendingForm = intakeForms.find((f) => f.status === 'pending');
  const formLink = pendingForm ? `${window.location.origin}/f/${pendingForm.token}` : undefined;

  useEffect(() => {
    if (isOpen) setTo(clientEmail || '');
  }, [isOpen, clientEmail]);

  const handleGenerate = async () => {
    try {
      const data = await generateMutation.mutateAsync({ clientId, formLink });
      setResult(data);
      setMessage(data.message);
      setSubject(data.subject || DEFAULT_SUBJECT);
      if (!formLink) {
        toast.warning('아직 만든 질문폼이 없어서 메시지에 링크가 빠졌어요. 질문폼을 먼저 만들어주세요.');
      }
    } catch {
      toast.error('리스트 생성에 실패했습니다.');
    }
  };

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
      await refetchHistory();
    } catch {
      toast.error('발송에 실패했습니다. Gmail 연동 설정을 확인해주세요.');
    }
  };

  const handleMarkSmsSent = async () => {
    try {
      await logManualMutation.mutateAsync({ clientId, to: clientPhone, subject: subject.trim(), body: message });
      toast.success('문자 발송완료로 기록했어요.');
      await refetchHistory();
    } catch {
      toast.error('기록에 실패했습니다.');
    }
  };

  const handleClose = () => {
    setResult(null);
    setMessage('');
    setSubject(DEFAULT_SUBJECT);
    setPreviewHtml(null);
    onClose();
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            전달받을 자료 안내
          </DialogTitle>
          <DialogDescription>
            고객사 정보·상담 이력을 참고해서 제작 전에 받아야 할 자료 리스트와, 고객에게 그대로 보낼 안내 메시지를 만들어줍니다.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="py-6">
              <p className="text-sm text-muted-foreground text-left">
                고객사 메모·상담 이력을 분석해서 로고, 질문폼 외에 이 고객사에 맞는 준비자료를 추천해드려요.
              </p>
            </div>

            {history.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  발송 이력
                </p>
                <ul className="space-y-1.5 border border-border rounded-lg p-3 max-h-32 overflow-y-auto">
                  {history.map((h) => (
                    <HistoryItem key={h.id} h={h} />
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} disabled={generateMutation.isPending}>취소</Button>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2">
                {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                리스트 생성
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <ul className="space-y-2 border border-border rounded-lg p-3">
                {result.items.map((item, idx) => (
                  <li key={idx}>
                    <p className="text-sm font-medium text-foreground">· {item.label}</p>
                    <p className="text-xs text-muted-foreground ml-3">{item.description}</p>
                  </li>
                ))}
              </ul>

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

              {history.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    발송 이력
                  </p>
                  <ul className="space-y-1.5 border border-border rounded-lg p-3 max-h-28 overflow-y-auto">
                    {history.map((h) => (
                      <li key={h.id} className="text-xs">
                        <span className="text-muted-foreground">{formatSentAt(String(h.sentAt))}</span>
                        {' · '}
                        <span className="text-foreground">{h.toAddress}</span>
                        {' — '}
                        <span className="text-muted-foreground">{h.subject}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setResult(null)} disabled={generateMutation.isPending}>
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
          </>
        )}
      </DialogContent>
    </Dialog>

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
