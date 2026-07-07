import { useEstimate } from '@/contexts/EstimateContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Trash2, Edit, FileCheck, Loader2, Copy, CreditCard, CheckCircle2, FileDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useLocation } from 'wouter';
import { type DocumentType, getDocTypeLabel, calcTotalFinal } from '@/lib/types';
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
  const [selectedDocData, setSelectedDocData] = useState<{ totalMax: number; clientName: string; depositRatio: number } | null>(null);
  const [finalDepositAmount, setFinalDepositAmount] = useState(0);
  const [openingFinalId, setOpeningFinalId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'not_started'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const duplicateMutation = trpc.documents.duplicateAsEstimate.useMutation();
  const copyMutation = trpc.documents.copyDocument.useMutation();
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const { data: depositedIds = [], isLoading: isLoadingDepositedIds } = trpc.documents.getDepositedDocumentIds.useQuery(undefined, { enabled: type === 'estimate' });
  const { data: finalPaidIds = [], isLoading: isLoadingFinalPaidIds } = trpc.documents.getFinalPaidDocumentIds.useQuery(undefined, { enabled: type === 'estimate' });
  const isLoadingPaymentStatus = isLoadingDepositedIds || isLoadingFinalPaidIds;
  const depositedSet = new Set(depositedIds);
  const finalPaidSet = new Set(finalPaidIds);
  const utils = trpc.useUtils();

  const documents = type === 'proposal' ? proposals : estimates;
  const docLabel = getDocTypeLabel(type);
  const IconComponent = type === 'proposal' ? FileText : FileCheck;

  // 계약금/잔금 완납 여부에 따른 진행 상태 (견적 및 계약서 목록에서만 의미 있음)
  const filteredDocuments = documents.filter((doc) => {
    if (type === 'estimate' && statusFilter !== 'all') {
      const docIdNum = parseInt(doc.id!);
      const isDeposited = depositedSet.has(docIdNum);
      const isFinalPaid = finalPaidSet.has(docIdNum);
      const status: 'completed' | 'in_progress' | 'not_started' = isFinalPaid ? 'completed' : isDeposited ? 'in_progress' : 'not_started';
      if (status !== statusFilter) return false;
    }
    if (type === 'estimate' && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (!(doc.clientName || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedDocs = filteredDocuments.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleStatusFilterChange = (status: 'all' | 'completed' | 'in_progress' | 'not_started') => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

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

  const handleCopy = async (id: string) => {
    setCopyingId(id);
    try {
      const copied = await copyMutation.mutateAsync({ id: parseInt(id) });
      await utils.documents.list.invalidate();
      if (copied?.id) {
        navigate(type === 'proposal' ? `/proposals/${copied.id}` : `/estimates/${copied.id}`);
        toast.success('복사되었습니다. 제목과 고객 정보를 입력해 주세요.');
      }
    } catch {
      toast.error('복사에 실패했습니다.');
    } finally {
      setCopyingId(null);
    }
  };

  const handleOpenDepositDialog = (docId: number, totalMax: number, clientName: string, depositRatio: number) => {
    setSelectedDocId(docId);
    setSelectedDocData({ totalMax, clientName, depositRatio });
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

  const handleOpenFinalDialog = async (docId: number, totalMax: number, clientName: string, depositRatio: number) => {
    setOpeningFinalId(docId);
    try {
      // 계약 비율 추정치가 아니라 실제로 입금 확정된 계약금 금액을 사용
      const payments = await utils.documents.getPayments.fetch({ documentId: docId });
      const actualDeposit = payments
        .filter((p) => p.type === 'deposit')
        .reduce((sum, p) => sum + p.amount, 0);
      setSelectedDocId(docId);
      setSelectedDocData({ totalMax, clientName, depositRatio });
      setFinalDepositAmount(actualDeposit);
      setFinalDialogOpen(true);
    } catch {
      toast.error('결제 내역을 불러오지 못했습니다.');
    } finally {
      setOpeningFinalId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <IconComponent className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{docLabel} 목록</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoadingDocuments
              ? '불러오는 중...'
              : type === 'estimate' && (statusFilter !== 'all' || searchQuery.trim())
                ? `총 ${documents.length}개 중 ${filteredDocuments.length}개`
                : `총 ${documents.length}개`}
          </p>
        </div>
      </div>

      {type === 'estimate' && !isLoadingDocuments && documents.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            {([
              { key: 'all', label: '전체' },
              { key: 'completed', label: '완료' },
              { key: 'in_progress', label: '진행중' },
              { key: 'not_started', label: '미진행' },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleStatusFilterChange(opt.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  statusFilter === opt.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="회사이름 검색"
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
      )}

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
        <div className="text-left py-16 border border-border rounded-lg">
          <IconComponent className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-muted-foreground">아직 {docLabel}가 없습니다.</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-left py-16 border border-border rounded-lg">
          <IconComponent className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-muted-foreground">검색 조건에 맞는 {docLabel}가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <colgroup>
                <col className="w-[35%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[18%]" />
                <col className="w-[17%]" />
              </colgroup>
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">제목</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">고객사</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">날짜</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">금액</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">작업</th>
                </tr>
              </thead>
              <tbody>
                {pagedDocs.map((doc, idx) => {
                  const docIdNum = parseInt(doc.id!);
                  const isDeposited = depositedSet.has(docIdNum);
                  const isFinalPaid = finalPaidSet.has(docIdNum);

                  return (
                    <tr
                      key={doc.id}
                      className={`border-b border-border last:border-0 hover:bg-accent/30 transition-colors ${idx % 2 !== 0 ? 'bg-muted/10' : ''}`}
                    >
                      {/* 제목 */}
                      <td className="px-4 py-3 max-w-0 text-left">
                        <button
                          onClick={() => handleEdit(doc.id!)}
                          className="font-medium text-foreground hover:text-primary truncate block text-left w-full"
                        >
                          {doc.title || '(제목 없음)'}
                        </button>
                      </td>

                      {/* 고객사 */}
                      <td className="px-3 py-3 max-w-0 text-left">
                        <span className="text-muted-foreground truncate block text-left">
                          {doc.clientName || '—'}
                        </span>
                      </td>

                      {/* 날짜 */}
                      <td className="px-3 py-3 whitespace-nowrap text-left">
                        <span className="text-muted-foreground">{doc.date}</span>
                      </td>

                      {/* 금액 */}
                      <td className="px-3 py-3 text-left">
                        <span className="text-foreground/80">
                          {type === 'estimate'
                            ? `${(doc.totalMax || calcTotalFinal(doc.items)).toLocaleString('ko-KR')}원`
                            : doc.totalMin === doc.totalMax
                              ? `${doc.totalMin.toLocaleString('ko-KR')}원`
                              : `${doc.totalMin.toLocaleString('ko-KR')} ~ ${doc.totalMax.toLocaleString('ko-KR')}원`}
                        </span>
                      </td>

                      {/* 작업 버튼 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-start">
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
                            onClick={() => handleCopy(doc.id!)}
                            disabled={copyingId === doc.id}
                            className="h-7 px-2 text-xs gap-1 text-sky-600 hover:text-sky-700"
                          >
                            {copyingId === doc.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            복사
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
                              {isLoadingPaymentStatus ? (
                                <span className="flex items-center justify-center h-7 w-7 text-muted-foreground">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                </span>
                              ) : isDeposited ? (
                                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 px-1.5 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3" />
                                  계약금
                                </span>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenDepositDialog(docIdNum, doc.totalMax, doc.clientName, doc.depositRatio ?? 50)}
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
                                  onClick={() => handleOpenFinalDialog(docIdNum, doc.totalMax, doc.clientName, doc.depositRatio ?? 50)}
                                  disabled={openingFinalId === docIdNum}
                                  className="h-7 px-2 text-xs gap-1 text-blue-600 hover:text-blue-700"
                                >
                                  {openingFinalId === docIdNum ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CreditCard className="w-3 h-3" />
                                  )}
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredDocuments.length)} / {filteredDocuments.length}개
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
          key={`deposit-${selectedDocId}`}
          isOpen={depositDialogOpen}
          onClose={() => setDepositDialogOpen(false)}
          documentId={selectedDocId}
          totalAmount={selectedDocData.totalMax}
          depositRatio={selectedDocData.depositRatio}
          clientName={selectedDocData.clientName}
          onSuccess={handleDepositSuccess}
        />
      )}
      {selectedDocId && selectedDocData && (
        <FinalPaymentConfirmDialog
          key={`final-${selectedDocId}`}
          isOpen={finalDialogOpen}
          onClose={() => setFinalDialogOpen(false)}
          documentId={selectedDocId}
          totalAmount={selectedDocData.totalMax}
          depositAmount={finalDepositAmount}
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
