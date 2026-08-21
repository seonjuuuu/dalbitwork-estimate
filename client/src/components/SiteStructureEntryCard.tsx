import { Button } from '@/components/ui/button';
import { ListTree, HelpCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface SiteStructureEntry {
  id: string;
  menuStructure: { label: string; subItems: string[] }[];
  questions: string[];
  summary: string;
  generatedAt: string;
}

interface SiteStructureEntryCardProps {
  clientId: number;
  entry: SiteStructureEntry;
  index: number;
}

export default function SiteStructureEntryCard({ clientId, entry, index }: SiteStructureEntryCardProps) {
  const utils = trpc.useUtils();
  const deleteMutation = trpc.clients.deleteSiteStructure.useMutation();

  const handleDelete = async () => {
    if (!window.confirm('이 AI 구성안을 삭제하시겠습니까?')) return;
    try {
      await deleteMutation.mutateAsync({ id: clientId, entryId: entry.id });
      await utils.clients.get.invalidate({ id: clientId });
      toast.success('구성안이 삭제되었습니다.');
    } catch {
      toast.error('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground">
          {index + 1}차 · {new Date(entry.generatedAt).toLocaleDateString('ko-KR')}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="gap-1 h-6 text-xs text-destructive hover:text-destructive px-1.5"
        >
          <Trash2 className="w-3 h-3" />
          삭제
        </Button>
      </div>

      {entry.summary && (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 mb-3">
          {entry.summary}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
            <ListTree className="w-3.5 h-3.5" />
            메뉴 구성
          </p>
          <div className="space-y-2 border border-border rounded-lg p-3">
            {entry.menuStructure.map((m, idx) => (
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

        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
            <HelpCircle className="w-3.5 h-3.5" />
            고객에게 확인할 사항
          </p>
          <ul className="space-y-1 border border-border rounded-lg p-3">
            {entry.questions.length > 0 ? entry.questions.map((q, idx) => (
              <li key={idx} className="text-xs text-muted-foreground">- {q}</li>
            )) : (
              <li className="text-xs text-muted-foreground/60">확인이 필요한 사항이 없습니다.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
