import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface DepositConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: number;
  totalAmount: number;
  clientName: string;
  onSuccess?: () => void;
}

export default function DepositConfirmDialog({
  isOpen,
  onClose,
  documentId,
  totalAmount,
  clientName,
  onSuccess,
}: DepositConfirmDialogProps) {
  const [depositAmount, setDepositAmount] = useState<string>(
    Math.round(totalAmount * 0.5).toString()
  );
  const [isLoading, setIsLoading] = useState(false);
  const recordPaymentMutation = trpc.documents.recordPayment.useMutation();
  const utils = trpc.useUtils();

  const handleConfirm = async () => {
    if (!depositAmount || isNaN(Number(depositAmount))) {
      toast.error('유효한 금액을 입력해주세요.');
      return;
    }

    const amount = Math.round(Number(depositAmount));
    if (amount <= 0) {
      toast.error('0보다 큰 금액을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await recordPaymentMutation.mutateAsync({
        documentId,
        type: 'deposit',
        amount,
        paymentDate: today,
        notes: `${clientName} 계약금 입금`,
      });

      await utils.documents.list.invalidate();
      await utils.documents.getPayments.invalidate({ documentId });

      toast.success('계약금이 확정되었습니다.');
      onClose();
      onSuccess?.();
    } catch (error) {
      toast.error('계약금 확정에 실패했습니다.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setDepositAmount(value);
  };

  const handleReset = () => {
    setDepositAmount(Math.round(totalAmount * 0.5).toString());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>계약금 확정</DialogTitle>
          <DialogDescription>
            {clientName} 고객사의 계약금을 확정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="total-amount">총 계약금액</Label>
            <div className="text-lg font-semibold text-foreground">
              {totalAmount.toLocaleString('ko-KR')}원
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deposit-amount">계약금 (기본값: 50%)</Label>
            <Input
              id="deposit-amount"
              type="text"
              value={depositAmount ? Number(depositAmount).toLocaleString('ko-KR') : ''}
              onChange={handleAmountChange}
              placeholder="계약금을 입력하세요"
              className="text-right"
            />
            <div className="text-sm text-muted-foreground">
              {depositAmount ? `${Number(depositAmount).toLocaleString('ko-KR')}원` : '0원'}
            </div>
          </div>

          <div className="bg-accent/50 rounded-lg p-3">
            <div className="text-sm text-muted-foreground mb-2">
              <span className="font-semibold">잔금:</span> {(totalAmount - Number(depositAmount || 0)).toLocaleString('ko-KR')}원
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold">입금일:</span> {new Date().toLocaleDateString('ko-KR')}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isLoading}
          >
            기본값으로 초기화
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            확정
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
