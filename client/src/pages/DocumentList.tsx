import { useEstimate } from '@/contexts/EstimateContext';
import { Button } from '@/components/ui/button';
import { FileText, Trash2, Edit, FileCheck, Loader2, Copy, CreditCard, CheckCircle2, FileDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocation } from 'wouter';
import { type DocumentType, getDocTypeLabel } from '@/lib/types';
import { toast } from 'sonner';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import DepositConfirmDialog from '@/components/DepositConfirmDialog';
import FinalPaymentConfirmDialog from '@/components/FinalPaymentConfirmDialog';
import NotesEditPdfDialog from '@/components/NotesEditPdfDialog';
import type { DocumentData } from '@/lib/types';

const PAGE_SIZE = 10;

interface DocumentListProps {
  type: DocumentType;
}

export default function DocumentList({ type }: DocumentListProps) {
  const { proposals, estimates, deleteDocument, isLoadingDocuments } = useEstimate();
  const [, navigate] = useLocation();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [notesDialogDoc, setNotesDialogDoc] = useState<DocumentData | null>(null);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [finalDialogOpen, setFinalDialogOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedDocData, setSelectedDocData] = useState<{ totalMax: number; clientName: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const duplicateMutation = trpc.documents.duplicateAsEstimate.useMutation();
  const { data: depositedIds = [] } = trpc.documents.getDepositedDocumentIds.useQuery(undefined, { enabled: type === 'estimate' });
  const { data: finalPaidIds = [] } = trpc.documents.getFinalPaidDocumentIds.useQuery(undefined, { enabled: type === 'estimate' });
  const depositedSet = new Set(depositedIds);
  const finalPaidSet = new Set(finalPaidIds);
  const utils = trpc.useUtils();

  const documents = type === 'proposal' ? proposals : estimates;
  const docLabel = getDocTypeLabel(type);
  const IconComponent = type === 'proposal' ? FileText : FileCheck;

  const totalPages = Math.max(1, Math.ceil(documents.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedDocs = documents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
    } catch {
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
    utils.documents.getDepositedDocumentIds.invalidate();
  };

  const handleFinalSuccess = () => {
    utils.documents.list.invalidate();
    utils.documents.getFinalPaidDocumentIds.invalidate();
  };

  const handleOpenFinalDialog = (docId: number, totalMax: number, clientName: string) => {
    setSelectedDocId(docId);
    setSelectedDocData({ totalMax, clientName });
    setFinalDialogOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <IconComponent className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{docLabel} 목록</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoadingDocuments ? '불러오는 중...' : `총 ${documents.length}개`}
          </p>
        </div>
      </div>

      {isLoadingDocuments ? (
        <div className="border border-border rounded-lg overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/5" />
              <div className="h-4 bg-muted rounded w-1/6" />
              <div className="h-4 bg-muted rounded w-1/6 ml-auto" />
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-lg">
          <IconComponent className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-muted-foreground">아직 {docLabel}가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[2fr_1.4fr_0.8fr_1.4fr_auto] bg-muted/50 border-b border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground">
              <span>제목</span>
              <span>고객사</span>
              <span>날짜</span>
              <span>금액</span>
              <span className="min-w-[190px] text-right">작업</span>
            </div>

            {/* Rows */}
            {pagedDocs.map((doc, idx) => {
              const docIdNum = parseInt(doc.id!);
              const isDeposited = depositedSet.has(docIdNum);
              const isFinalPaid = finalPaidSet.has(docIdNum);

              return (
                <div
                  key={doc.id}
                  className={`grid grid-cols-[2fr_1.4fr_0.8fr_1.4fr_auto] items-center px-4 py-3 border-b border-border last:border-0 hover:bg-accent/30 transition-colors ${idx % 2 !== 0 ? 'bg-muted/10' : ''}`}
                >
                  {/* 제목 */}
                  <div className="min-w-0 pr-3">
                    <button
                      onClick={() => handleEdit(doc.id!)}
                      className="text-sm font-medium text-foreground hover:text-primary truncate block text-left w-full"
                    >
                      {doc.title || '(제목 없음)'}
                    </button>
                  </div>

                  {/* 고객사 */}
                  <div className="min-w-0 pr-3">
                    <span className="text-sm text-muted-foreground truncate block">
                      {doc.clientName || '—'}
                    </span>
                  </div>

                  {/* 날짜 */}
                  <div className="pr-3">
                    <span className="text-sm text-muted-foreground">{doc.date}</span>
                  </div>

                  {/* 금액 */}
                  <div className="pr-3">
                    <span className="text-sm text-foreground/80">
                      {doc.totalMin === doc.totalMax
                        ? `${doc.totalMin.toLocaleString('ko-KR')}원`
                        : `${doc.totalMin.toLocaleString('ko-KR')} ~ ${doc.totalMax.toLocaleString('ko-KR')}원`}
                    </span>
                  </div>

                  {/* 작업 버튼 */}
                  <div className="flex items-center gap-1 justify-end min-w-[190px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(doc.id!)}
                      className="h-7 px-2 text-xs gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      편집
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNotesDialogDoc(doc)}
                      className="h-7 px-2 text-xs gap-1 text-violet-600 hover:text-violet-700"
                    >
                      <FileDown className="w-3 h-3" />
                      PDF
                    </Button>

                    {type === 'proposal' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicateAsEstimate(doc.id!)}
                        disabled={duplicatingId === doc.id}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        {duplicatingId === doc.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        변환
                      </Button>
                    )}

                    {type === 'estimate' && (
                      <>
                        {isDeposited ? (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 px-1.5 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3" />
                            계약금
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDepositDialog(docIdNum, doc.totalMax, doc.clientName)}
                            className="h-7 px-2 text-xs gap-1 text-amber-600 hover:text-amber-700"
                          >
                            <CreditCard className="w-3 h-3" />
                            계약금
                          </Button>
                        )}

                        {isFinalPaid ? (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-blue-600 px-1.5 py-1 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3" />
                            잔금
                          </span>
                        ) : isDeposited && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenFinalDialog(docIdNum, doc.totalMax, doc.clientName)}
                            className="h-7 px-2 text-xs gap-1 text-blue-600 hover:text-blue-700"
                          >
                            <CreditCard className="w-3 h-3" />
                            잔금
                          </Button>
                        )}
                      </>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id!)}
                      disabled={deletingId === doc.id}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, documents.length)} / {documents.length}개
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={page === safePage ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="h-8 w-8 p-0 text-xs"
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
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
      {selectedDocId && selectedDocData && (
        <FinalPaymentConfirmDialog
          isOpen={finalDialogOpen}
          onClose={() => setFinalDialogOpen(false)}
          documentId={selectedDocId}
          totalAmount={selectedDocData.totalMax}
          depositAmount={Math.round(selectedDocData.totalMax * 0.5)}
          clientName={selectedDocData.clientName}
          onSuccess={handleFinalSuccess}
        />
      )}
      {notesDialogDoc && (
        <NotesEditPdfDialog
          doc={notesDialogDoc}
          isOpen={!!notesDialogDoc}
          onClose={() => setNotesDialogDoc(null)}
        />
      )}
    </div>
  );
}
