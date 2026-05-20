import { useEstimate } from '@/contexts/EstimateContext';
import { Button } from '@/components/ui/button';
import { FileText, Trash2, Edit, FileCheck, Loader2, Copy, CreditCard } from 'lucide-react';
import { useLocation } from 'wouter';
import { type DocumentType, getDocTypeLabel } from '@/lib/types';
import { toast } from 'sonner';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import DepositConfirmDialog from '@/components/DepositConfirmDialog';

interface DocumentListProps {
  type: DocumentType;
}

export default function DocumentList({ type }: DocumentListProps) {
  const { proposals, estimates, deleteDocument } = useEstimate();
  const [, navigate] = useLocation();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedDocData, setSelectedDocData] = useState<{ totalMax: number; clientName: string } | null>(null);
  const duplicateMutation = trpc.documents.duplicateAsEstimate.useMutation();
  const utils = trpc.useUtils();

  const documents = type === 'proposal' ? proposals : estimates;
  const docLabel = getDocTypeLabel(type);
  const IconComponent = type === 'proposal' ? FileText : FileCheck;

  const handleEdit = (id: string) => {
    navigate(type === 'proposal' ? `/proposals/${id}` : `/estimates/${id}`);
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

  const handleDuplicateAsEstimate = async (id: string) => {
    setDuplicatingId(id);
    try {
      const estimate = await duplicateMutation.mutateAsync({ id: parseInt(id) });
      await utils.documents.list.invalidate();
      if (estimate && estimate.id) {
        navigate(`/estimates/${estimate.id}`);
        toast.success('견적서로 변환되었습니다.');
      }
    } catch (error) {
      toast.error('변환에 실패했습니다.');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleOpenDepositDialog = (docId: number, totalMax: number, clientName: string) => {
    setSelectedDocId(docId);
    setSelectedDocData({ totalMax, clientName });
    setDepositDialogOpen(true);
  };

  const handleDepositSuccess = () => {
    utils.documents.list.invalidate();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-8">
        <IconComponent className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{docLabel} 목록</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {documents.length}개의 {docLabel}가 있습니다.
          </p>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12">
          <IconComponent className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">아직 {docLabel}가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{doc.title || '(제목 없음)'}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {doc.clientName || '(고객사 없음)'} • {doc.date}
                </p>
                <span className="text-sm text-muted-foreground">
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
                  {type === 'proposal' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateAsEstimate(doc.id!)}
                      disabled={duplicatingId === doc.id}
                      className="text-xs gap-1"
                    >
                      {duplicatingId === doc.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      견적서로 변환
                    </Button>
                  )}
                  {type === 'estimate' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDepositDialog(parseInt(doc.id!), doc.totalMax, doc.clientName)}
                      className="text-xs gap-1 text-amber-600 hover:text-amber-700"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      계약금 확정
                    </Button>
                  )}
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

      {selectedDocId && selectedDocData && (
        <DepositConfirmDialog
          isOpen={depositDialogOpen}
          onClose={() => setDepositDialogOpen(false)}
          documentId={selectedDocId}
          totalAmount={selectedDocData.totalMax}
          clientName={selectedDocData.clientName}
          onSuccess={handleDepositSuccess}
        />
      )}
    </div>
  );
}
