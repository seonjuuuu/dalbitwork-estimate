import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const WORDMARK_LOGO_URL = '/logo-full.png';
const KAKAO_ID = 'dalbit.work';
const PHONE_NUMBER = '010.2757.9116';

const INTRO_TEXT = `안녕하세요. 달빛워크입니다.

기획 폼 작성 전에 아래 내용을 꼭 숙지해 주세요!!
✅ 정성껏 적어주시면 매출이 올라가는 홈페이지를 약속드리겠습니다.

홈페이지를 만들 때 함께 기획하면 훨씬 더 원하는 방향성으로 빠르게 제작이 가능합니다.

달빛워크 홈페이지 제작의 강점은 2가지 입니다.

1. 빠른 제작, 확실한 방향성
→ 처음부터 함께 기획하고 소통하며 제작하기 때문에 고객님의 브랜드 방향성을 정확히 반영할 수 있습니다.

2. 브랜드를 말하게 만드는 카피라이팅
→ 단순히 글을 쓰는 것이 아니라, 방문자를 '설득'하고 '행동하게 만드는 문장'을 만듭니다.

잠재고객을 설득시키기 위해서는 문의주신 회사의 강점을 200% 이해하고 기획해야 더 좋은 결과물을 만들 수 있습니다.

달빛처럼 조용히, 하지만 확실하게 빛나는 결과물.
비트처럼 정교하게, 단단하게 설계된 홈페이지.
달빛워크는 고객님의 브랜드를 가장 아름답게 비춰줄 홈페이지를 만들어 드립니다.

작성 중 이해가 안 되는 부분이 있다면 언제든지 편하게 연락주세요.`;

export default function PublicIntakeForm({ token }: { token: string }) {
  const { data: form, isLoading, error } = trpc.forms.getByToken.useQuery({ token });
  const submitMutation = trpc.forms.submit.useMutation();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!form) return;
    const missingRequired = form.questions.some((q, i) => q.required && !(answers[i] || '').trim());
    if (missingRequired) {
      toast.error('필수 항목(*)을 모두 입력해주세요.');
      return;
    }
    try {
      await submitMutation.mutateAsync({
        token,
        answers: form.questions.map((_, i) => (answers[i] || '').trim()),
      });
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '제출에 실패했습니다.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4 py-10">
      <div className="w-full max-w-lg mx-auto">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src={WORDMARK_LOGO_URL} alt="달빛워크" className="h-10 w-auto object-contain" />
          <h1 className="text-lg font-bold text-foreground">홈페이지 기획 질문폼</h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !form ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">유효하지 않은 링크예요. 보내주신 분께 다시 확인해주세요.</p>
          </div>
        ) : form.status === 'submitted' || submitted ? (
          <div className="text-center py-16 flex flex-col items-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">답변이 제출됐어요. 감사합니다!</p>
            <p className="text-xs text-muted-foreground">확인 후 곧 연락드릴게요.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{INTRO_TEXT}</p>
              <p className="mt-3 text-xs font-medium text-foreground">
                카카오톡 ID: {KAKAO_ID} · 연락처: {PHONE_NUMBER}
              </p>
            </div>

            <p className="text-sm md:text-base text-muted-foreground text-center">대표님, 아래 질문에 답변해주세요.</p>

            <div className="space-y-5">
              {form.questions.map((q, i) => (
                <div key={i}>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    {i + 1}. {q.text}
                    {q.required && <span className="text-destructive"> *</span>}
                  </label>
                  {q.type === 'select' ? (
                    <div className="space-y-2">
                      {(q.options || []).map((opt, optIdx) => (
                        <label
                          key={optIdx}
                          className="flex items-center gap-2 text-sm text-foreground border border-input rounded-md px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
                        >
                          <input
                            type="radio"
                            name={`q-${i}`}
                            checked={answers[i] === opt}
                            onChange={() => setAnswers((a) => ({ ...a, [i]: opt }))}
                            className="w-3.5 h-3.5 accent-primary"
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : q.type === 'text' ? (
                    <Input
                      value={answers[i] || ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                      placeholder="답변을 입력해주세요..."
                    />
                  ) : (
                    <Textarea
                      value={answers[i] || ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                      rows={3}
                      placeholder="답변을 입력해주세요..."
                    />
                  )}
                </div>
              ))}
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                제출하기
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
