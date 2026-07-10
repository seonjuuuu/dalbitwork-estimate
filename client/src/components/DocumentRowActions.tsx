import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useEstimate } from '@/contexts/EstimateContext';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, FileDown, Trash2, CreditCard, CheckCircle2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import DepositConfirmDialog from '@/components/DepositConfirmDialog';
import FinalPaymentConfirmDialog from '@/components/FinalPaymentConfirmDialog';
import NotesEditPdfDialog from '@/components/NotesEditPdfDialog';

interface DocumentRowActionsProps {
  docId: number;
  docType: 'proposal' | 'estimate';
  totalMax: number;
  clientName: string;
  depositRatio?: number;
  onDeleted?: () => void;
  /** 계약금/잔금 버튼을 이 컴포넌트 안에 표시할지 여부 (별도 컬럼으로 뺄 때는 false) */
  showDepositFinal?: boolean;
}

export default function DocumentRowActions({ docId, docType, totalMax, clientName, depositRatio, onDeleted, showDepositFinal = true }: DocumentRowActionsProps) {
  const [, navigate] = useLocation();
  const { proposals, estimates, deleteDocument } = useEstimate();
  const utils = trpc.useUtils();
  const copyMutation = trpc.documents.copyDocument.useMutation();
  const duplicateMutation = trpc.documents.duplicateAsEstimate.useMutation();
  const { data: depositedIds = [] } = trpc.documents.getDepositedDocumentIds.useQuery(undefined, { enabled: docType === 'estimate' && showDepositFinal });
  const { data: finalPaidIds = [] } = trpc.documents.getFinalPaidDocumentIds.useQuery(undefined, { enabled: docType === 'estimate' && showDepositFinal });
  const isDeposited = new Set(depositedIds).has(docId);
  const isFinalPaid = new Set(finalPaidIds).has(docId);

  const [copying, setCopying] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openingFinal, setOpeningFinal] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [finalDialogOpen, setFinalDialogOpen] = useState(false);
  const [finalDepositAmount, setFinalDepositAmount] = useState(0);

  const fullDoc = (docType === 'proposal' ? proposals : estimates).find((d) => d.id === String(docId));

  const handleEdit = () => navigate(docType === 'proposal' ? `/proposals/${docId}` : `/estimates/${docId}`);

  const handleCopy = async () => {
    setCopying(true);
    try {
      const copied = await copyMutation.mutateAsync({ id: docId });
      await utils.documents.list.invalidate();
      if (copied?.id) {
        navigate(docType === 'proposal' ? `/proposals/${copied.id}` : `/estimates/${copied.id}`);
        toast.success('복사되었습니다. 제목과 고객 정보를 입력해 주세요.');
      }
    } catch {
      toast.error('복사에 실패했습니다.');
    } finally {
      setCopying(false);
    }
  };

  const handleDuplicateAsEstimate = async () => {
    setDuplicating(true);
    try {
      const estimate = await duplicateMutation.mutateAsync({ id: docId });
      await utils.documents.list.invalidate();
      if (estimate?.id) {
        navigate(`/estimates/${estimate.id}`);
        toast.success('견적서로 변환되었습니다.');
      }
    } catch {
      toast.error('변환에 실패했습니다.');
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async () => {
    const label = docType === 'proposal' ? '제안서' : '견적서';
    if (!window.confirm(`이 ${label}를 삭제하시겠습니까?`)) return;
    setDeleting(true);
    try {
      await deleteDocument(String(docId), docType);
      toast.success(`${label}가 삭제되었습니다.`);
      onDeleted?.();
    } catch {
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDepositSuccess = () => {
    utils.documents.list.invalidate();
    utils.documents.getDepositedDocumentIds.invalidate();
  };

  const handleFinalSuccess = () => {
    utils.documents.list.invalidate();
    utils.documents.getFinalPaidDocumentIds.invalidate();
  };

  const handleOpenFinalDialog = async () => {
    setOpeningFinal(true);
    try {
      const paymentsList = await utils.documents.getPayments.fetch({ documentId: docId });
      const actualDeposit = paymentsList
        .filter((p) => p.type === 'deposit')
        .reduce((sum, p) => sum + p.amount, 0);
      setFinalDepositAmount(actualDeposit);
      setFinalDialogOpen(true);
    } catch {
      toast.error('결제 내역을 불러오지 못했습니다.');
    } finally {
      setOpeningFinal(false);
    }
  };

  const btnCls = 'h-6 px-2 text-[11px] gap-1';

  return (
    <>
      <div className="flex items-center gap-0.5 flex-wrap">
        <Button variant="ghost" size="sm" onClick={handleEdit} title="편집" className={btnCls}>
          <Edit className="w-3 h-3" /> 편집
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setNotesDialogOpen(true)}
          disabled={!fullDoc}
          title="PDF"
          className={`${btnCls} text-violet-600 hover:text-violet-700`}
        >
          <FileDown className="w-3 h-3" /> PDF
        </Button>
        <Button variant="ghost" size="sm" onClick={handleCopy} disabled={copying} title="복사" className={`${btnCls} text-sky-600 hover:text-sky-700`}>
          {copying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />} 복사
        </Button>
        {docType === 'proposal' && (
          <Button variant="ghost" size="sm" onClick={handleDuplicateAsEstimate} disabled={duplicating} title="견적서 변환" className={btnCls}>
            {duplicating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />} 변환
          </Button>
        )}
        {docType === 'estimate' && showDepositFinal && (
          <>
            {isDeposited ? (
              <span
                title="계약금 입금 완료"
                className="flex items-center justify-center gap-1 text-[10px] font-medium text-emerald-600 rounded px-1.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap"
              >
                <CheckCircle2 className="w-3 h-3" /> 계약금
              </span>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setDepositDialogOpen(true)} title="계약금 확정" className={`${btnCls} text-amber-600 hover:text-amber-700`}>
                <CreditCard className="w-3 h-3" /> 계약금
              </Button>
            )}
            {isFinalPaid ? (
              <span
                title="잔금 입금 완료"
                className="flex items-center justify-center gap-1 text-[10px] font-medium text-blue-600 rounded px-1.5 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 whitespace-nowrap"
              >
                <CheckCircle2 className="w-3 h-3" /> 잔금
              </span>
            ) : isDeposited && (
              <Button variant="ghost" size="sm" onClick={handleOpenFinalDialog} disabled={openingFinal} title="잔금 확정" className={`${btnCls} text-blue-600 hover:text-blue-700`}>
                {openingFinal ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />} 잔금
              </Button>
            )}
          </>
        )}
        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting} title="삭제" className={`${btnCls} text-destructive hover:text-destructive`}>
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} 삭제
        </Button>
      </div>

      {showDepositFinal && (
        <>
          <DepositConfirmDialog
            isOpen={depositDialogOpen}
            onClose={() => setDepositDialogOpen(false)}
            documentId={docId}
            totalAmount={totalMax}
            depositRatio={depositRatio ?? 50}
            clientName={clientName}
            onSuccess={handleDepositSuccess}
          />
          <FinalPaymentConfirmDialog
            isOpen={finalDialogOpen}
            onClose={() => setFinalDialogOpen(false)}
            documentId={docId}
            totalAmount={totalMax}
            depositAmount={finalDepositAmount}
            clientName={clientName}
            onSuccess={handleFinalSuccess}
          />
        </>
      )}
      {fullDoc && (
        <NotesEditPdfDialog
          doc={fullDoc}
          isOpen={notesDialogOpen}
          onClose={() => setNotesDialogOpen(false)}
        />
      )}
    </>
  );
}
