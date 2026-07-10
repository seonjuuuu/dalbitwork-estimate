import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, CheckCircle2 } from 'lucide-react';
import DepositConfirmDialog from '@/components/DepositConfirmDialog';
import FinalPaymentConfirmDialog from '@/components/FinalPaymentConfirmDialog';

interface DepositFinalCellProps {
  kind: 'deposit' | 'final';
  docId: number;
  totalMax: number;
  clientName: string;
  depositRatio?: number;
}

export default function DepositFinalCell({ kind, docId, totalMax, clientName, depositRatio }: DepositFinalCellProps) {
  const utils = trpc.useUtils();
  const { data: depositedIds = [] } = trpc.documents.getDepositedDocumentIds.useQuery();
  const { data: finalPaidIds = [] } = trpc.documents.getFinalPaidDocumentIds.useQuery();
  const isDeposited = new Set(depositedIds).has(docId);
  const isFinalPaid = new Set(finalPaidIds).has(docId);

  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [finalDialogOpen, setFinalDialogOpen] = useState(false);
  const [openingFinal, setOpeningFinal] = useState(false);
  const [finalDepositAmount, setFinalDepositAmount] = useState(0);

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
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 rounded px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3" /> 입금완료
          </span>
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
      </>
    );
  }

  return (
    <>
      {isFinalPaid ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 rounded px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3" /> 입금완료
        </span>
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
    </>
  );
}
