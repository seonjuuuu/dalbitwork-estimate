import { useEstimate } from '@/contexts/EstimateContext';
import { Button } from '@/components/ui/button';
import { FileText, Trash2, Edit, FileCheck, Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { type DocumentType, getDocTypeLabel } from '@/lib/types';
import { toast } from 'sonner';
import { useState } from 'react';

interface DocumentListProps {
  type: DocumentType;
}

export default function DocumentList({ type }: DocumentListProps) {
  const { proposals, estimates, loadDocument, deleteDocument } = useEstimate();
  const [, navigate] = useLocation();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const documents = type === 'proposal' ? proposals : estimates;
  const docLabel = getDocTypeLabel(type);
  const IconComponent = type === 'proposal' ? FileText : FileCheck;

  const handleEdit = (id: string) => {
    loadDocument(id, type);
    navigate('/');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`이 ${docLabel}를 삭제하시겠습니까?`)) return;
    setDeletingId(id);
    try {
      await deleteDocument(id, type);
      toast.success(`${docLabel}가 삭제되었습니다.`);
    } catch {
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-8">
        <IconComponent className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground">{docLabel} 목록</h1>
        <span className="text-sm text-muted-foreground">({documents.length}건)</span>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <IconComponent className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">저장된 {docLabel}가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-card border border-border rounded-lg p-5 flex items-center justify-between hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  type === 'proposal' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {doc.title || doc.clientName || '(미입력)'}
                  </h3>
                  {doc.title && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {doc.clientName || '고객사 미입력'}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {doc.projectName || '프로젝트명 미입력'} · {doc.date}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold amount text-foreground">
                  {doc.totalMin === doc.totalMax
                    ? `${doc.totalMin.toLocaleString('ko-KR')}원`
                    : `${doc.totalMin.toLocaleString('ko-KR')} ~ ${doc.totalMax.toLocaleString('ko-KR')}원`}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(doc.id!)}
                    className="text-xs gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    편집
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(doc.id!)}
                    disabled={deletingId === doc.id}
                    className="text-xs gap-1 text-destructive hover:text-destructive"
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
