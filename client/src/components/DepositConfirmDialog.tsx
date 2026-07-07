import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ko } from 'date-fns/locale';
import { CalendarDays, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface DepositConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: number;
  totalAmount: number;
  depositRatio?: number;
  clientName: string;
  onSuccess?: () => void;
}

function todayDotStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function dotStrToDate(str: string): Date | undefined {
  const parts = str.split('.');
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return undefined;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? undefined : date;
}

function dotStrToIso(str: string): string {
  const parts = str.split('.');
  if (parts.length !== 3) return str;
  return `${parts[0]}-${parts[1]}-${parts[2]}`;
}

export default function DepositConfirmDialog({
  isOpen,
  onClose,
  documentId,
  totalAmount,
  depositRatio = 50,
  clientName,
  onSuccess,
}: DepositConfirmDialogProps) {
  const [depositAmount, setDepositAmount] = useState<string>(
    Math.round(totalAmount * (depositRatio / 100)).toString()
  );
  const [paymentDate, setPaymentDate] = useState(todayDotStr());
  const [isLoading, setIsLoading] = useState(false);
  const recordPaymentMutation = trpc.documents.recordPayment.useMutation();
  const utils = trpc.useUtils();

  const handleDateInput = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 4) + '.' + digits.slice(4);
    if (digits.length > 6) formatted = digits.slice(0, 4) + '.' + digits.slice(4, 6) + '.' + digits.slice(6);
    setPaymentDate(formatted);
  };

  const handleConfirm = async () => {
    const amount = Math.round(Number(depositAmount));
    if (!amount || amount <= 0) {
      toast.error('유효한 금액을 입력해주세요.');
      return;
    }
    if (!dotStrToDate(paymentDate)) {
      toast.error('유효한 날짜를 입력해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      await recordPaymentMutation.mutateAsync({
        documentId,
        type: 'deposit',
        amount,
        paymentDate: dotStrToIso(paymentDate),
        notes: `${clientName} 계약금 입금`,
      });
      await utils.documents.list.invalidate();
      await utils.documents.getPayments.invalidate({ documentId });
      toast.success('계약금이 확정되었습니다.');
      onClose();
      onSuccess?.();
    } catch {
      toast.error('계약금 확정에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>계약금 확정</DialogTitle>
          <DialogDescription>{clientName} 고객사의 계약금을 확정합니다.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>총 계약금액</Label>
            <p className="text-lg font-semibold text-foreground mt-1">{totalAmount.toLocaleString('ko-KR')}원</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deposit-amount">계약금 (기본값: {depositRatio}%)</Label>
            <Input
              id="deposit-amount"
              type="text"
              value={depositAmount ? Number(depositAmount).toLocaleString('ko-KR') : ''}
              onChange={e => setDepositAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="계약금을 입력하세요"
              className="text-right"
            />
            <p className="text-xs text-muted-foreground">
              잔금: {(totalAmount - Number(depositAmount || 0)).toLocaleString('ko-KR')}원
            </p>
          </div>

          <div className="space-y-2">
            <Label>입금일</Label>
            <div className="flex gap-2">
              <Input
                value={paymentDate}
                onChange={e => handleDateInput(e.target.value)}
                placeholder="20260608"
                maxLength={10}
                className="text-sm"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button className="h-9 w-9 flex items-center justify-center rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0">
                    <CalendarDays className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    locale={ko}
                    selected={dotStrToDate(paymentDate)}
                    onSelect={date => {
                      if (!date) return;
                      const y = date.getFullYear();
                      const m = String(date.getMonth() + 1).padStart(2, '0');
                      const d = String(date.getDate()).padStart(2, '0');
                      setPaymentDate(`${y}.${m}.${d}`);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { setDepositAmount(Math.round(totalAmount * (depositRatio / 100)).toString()); setPaymentDate(todayDotStr()); }} disabled={isLoading}>
            초기화
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>취소</Button>
          <Button onClick={handleConfirm} disabled={isLoading} className="gap-2">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            확정
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
