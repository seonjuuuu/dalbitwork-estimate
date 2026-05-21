import { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, FileText, Copy } from 'lucide-react';
import { useEstimate } from '@/contexts/EstimateContext';
import { getDocTypeLabel } from '@/lib/types';
import type { DocumentData } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCopied: () => void;
}

export default function CopyFromDocumentDialog({ open, onClose, onCopied }: Props) {
  const { proposals, estimates, copyFromDocument } = useEstimate();
  const [search, setSearch] = useState('');

  const allDocs = useMemo(() => {
    const merged = [...proposals, ...estimates].sort(
      (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
    );
    if (!search.trim()) return merged;
    const q = search.toLowerCase();
    return merged.filter(
      (d) =>
        d.clientName.toLowerCase().includes(q) ||
        d.projectName.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q)
    );
  }, [proposals, estimates, search]);

  const handleSelect = (doc: DocumentData) => {
    copyFromDocument(doc);
    onClose();
    onCopied();
    setSearch('');
  };

  const formatDate = (iso: string | undefined) => iso?.slice(0, 10).replace(/-/g, '.') ?? '';
  const formatAmount = (n: number) =>
    n >= 10000 ? `${(n / 10000).toFixed(0)}만원` : n > 0 ? `${n.toLocaleString('ko-KR')}원` : '';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setSearch(''); } }}>
      <DialogContent className="sm:max-w-[560px] max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-4 h-4" />
            이전 문서에서 복사
          </DialogTitle>
          <DialogDescription>
            선택한 문서의 항목·참고사항 등을 새 문서로 복사합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="고객사명, 프로젝트명, 제목으로 검색..."
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-1.5">
          {allDocs.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              검색 결과가 없습니다.
            </div>
          ) : (
            allDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleSelect(doc)}
                className="w-full text-left flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
              >
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">
                      {doc.clientName || '(수신처 없음)'}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      doc.type === 'proposal'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    }`}>
                      {getDocTypeLabel(doc.type)}
                    </span>
                  </div>
                  {doc.projectName && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.projectName}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">{formatDate(doc.updatedAt ?? undefined)}</span>
                    {doc.items.length > 0 && (
                      <span className="text-xs text-muted-foreground">항목 {doc.items.length}개</span>
                    )}
                    {doc.totalMin > 0 && (
                      <span className="text-xs font-medium text-foreground">{formatAmount(doc.totalMin)}</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
