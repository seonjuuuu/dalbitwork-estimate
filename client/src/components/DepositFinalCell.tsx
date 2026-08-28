import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, CheckCircle2, Pencil } from 'lucide-react';
import DepositConfirmDialog from '@/components/DepositConfirmDialog';
import FinalPaymentConfirmDialog from '@/components/FinalPaymentConfirmDialog';
import PaymentEditDialog from '@/components/PaymentEditDialog';

interface DepositFinalCellProps {
  kind: 'deposit' | 'final';
  docId: number;
  totalMax: number;
  clientName: string;
  depositRatio?: number;
}

export default function DepositFinalCell({ kind, docId, totalMax, clientName, depositRatio }: DepositFinalCellProps) {
  const utils = trpc.useUtils();
  const { data: depositedIds = [], isLoading: isLoadingDeposited } = trpc.documents.getDepositedDocumentIds.useQuery();
  const { data: finalPaidIds = [], isLoading: isLoadingFinalPaid } = trpc.documents.getFinalPaidDocumentIds.useQuery();
  const isDeposited = new Set(depositedIds).has(docId);
  const isFinalPaid = new Set(finalPaidIds).has(docId);
  const isLoadingStatus = kind === 'deposit' ? isLoadingDeposited : isLoadingDeposited || isLoadingFinalPaid;

  if (isLoadingStatus) {
    return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />;
  }

  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [finalDialogOpen, setFinalDialogOpen] = useState(false);
  const [openingFinal, setOpeningFinal] = useState(false);
  const [finalDepositAmount, setFinalDepositAmount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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
    } finally {
      setOpeningFinal(false);
    }
  };

  if (kind === 'deposit') {
    return (
      <>
        {isDeposited ? (
          <button
            type="button"
            onClick={() => setEditDialogOpen(true)}
            title="계약금 입금 기록 수정"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 rounded px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
          >
            <CheckCircle2 className="w-3 h-3" /> 입금완료 <Pencil className="w-2.5 h-2.5 opacity-60" />
          </button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setDepositDialogOpen(true)} className="h-7 px-2 text-[11px] gap-1 text-amber-600 hover:text-amber-700">
            <CreditCard className="w-3 h-3" /> 확정
          </Button>
        )}
        <DepositConfirmDialog
          isOpen={depositDialogOpen}
          onClose={() => setDepositDialogOpen(false)}
          documentId={docId}
          totalAmount={totalMax}
          depositRatio={depositRatio ?? 50}
          clientName={clientName}
          onSuccess={handleDepositSuccess}
        />
        <PaymentEditDialog
          isOpen={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          documentId={docId}
          type="deposit"
          clientName={clientName}
          onChanged={handleDepositSuccess}
        />
      </>
    );
  }

  return (
    <>
      {isFinalPaid ? (
        <button
          type="button"
          onClick={() => setEditDialogOpen(true)}
          title="잔금 입금 기록 수정"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 rounded px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 whitespace-nowrap hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
        >
          <CheckCircle2 className="w-3 h-3" /> 입금완료 <Pencil className="w-2.5 h-2.5 opacity-60" />
        </button>
      ) : isDeposited ? (
        <Button variant="outline" size="sm" onClick={handleOpenFinalDialog} disabled={openingFinal} className="h-7 px-2 text-[11px] gap-1 text-blue-600 hover:text-blue-700">
          {openingFinal ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />} 확정
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
      <FinalPaymentConfirmDialog
        isOpen={finalDialogOpen}
        onClose={() => setFinalDialogOpen(false)}
        documentId={docId}
        totalAmount={totalMax}
        depositAmount={finalDepositAmount}
        clientName={clientName}
        onSuccess={handleFinalSuccess}
      />
      <PaymentEditDialog
        isOpen={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        documentId={docId}
        type="final"
        clientName={clientName}
        onChanged={handleFinalSuccess}
      />
    </>
  );
}
