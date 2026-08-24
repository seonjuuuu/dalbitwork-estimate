import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import EmailComposeFields from './EmailComposeFields';

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

export default function ClientRequestChecklistDialog({
  isOpen,
  onClose,
  clientId,
  clientEmail,
  clientPhone,
}: ClientRequestChecklistDialogProps) {
  const [result, setResult] = useState<ClientRequestChecklistResult | null>(null);
  const generateMutation = trpc.ai.generateClientRequestChecklist.useMutation();
  const { data: intakeForms = [] } = trpc.forms.listByClient.useQuery({ clientId }, { enabled: isOpen });
  const pendingForm = intakeForms.find((f) => f.status === 'pending');
  const formLink = pendingForm ? (pendingForm.shortLink || `${window.location.origin}/f/${pendingForm.token}`) : undefined;

  const handleGenerate = async () => {
    try {
      const data = await generateMutation.mutateAsync({ clientId, formLink });
      setResult(data);
      if (!formLink) {
        toast.warning('아직 만든 질문폼이 없어서 메시지에 링크가 빠졌어요. 질문폼을 먼저 만들어주세요.');
      }
    } catch {
      toast.error('리스트 생성에 실패했습니다.');
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
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
            <ul className="space-y-2 border border-border rounded-lg p-3">
              {result.items.map((item, idx) => (
                <li key={idx}>
                  <p className="text-sm font-medium text-foreground">· {item.label}</p>
                  <p className="text-xs text-muted-foreground ml-3">{item.description}</p>
                </li>
              ))}
            </ul>
            <EmailComposeFields
              clientId={clientId}
              clientEmail={clientEmail}
              clientPhone={clientPhone}
              initialSubject={result.subject || DEFAULT_SUBJECT}
              initialMessage={result.message}
              onRegenerate={() => setResult(null)}
              isRegenerating={generateMutation.isPending}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
