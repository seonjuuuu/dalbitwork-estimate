import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { ko } from 'date-fns/locale';
import { CalendarDays, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface FinalPaymentConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: number;
  totalAmount: number;
  depositAmount: number;
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

export default function FinalPaymentConfirmDialog({
  isOpen,
  onClose,
  documentId,
  totalAmount,
  depositAmount,
  clientName,
  onSuccess,
}: FinalPaymentConfirmDialogProps) {
  const remaining = Math.max(0, totalAmount - depositAmount);
  const [finalAmount, setFinalAmount] = useState<string>(remaining.toString());
  const [paymentDate, setPaymentDate] = useState(todayDotStr());
  const [cashReceiptIssued, setCashReceiptIssued] = useState(false);
  const [cashReceiptDate, setCashReceiptDate] = useState(todayDotStr());
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

  const handleCashReceiptDateInput = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 4) + '.' + digits.slice(4);
    if (digits.length > 6) formatted = digits.slice(0, 4) + '.' + digits.slice(4, 6) + '.' + digits.slice(6);
    setCashReceiptDate(formatted);
  };

  const handleConfirm = async () => {
    const amount = Number(finalAmount.replace(/,/g, ''));
    if (!amount || amount <= 0) {
      toast.error('유효한 금액을 입력해주세요.');
      return;
    }
    if (!dotStrToDate(paymentDate)) {
      toast.error('유효한 날짜를 입력해주세요.');
      return;
    }
    if (cashReceiptIssued && !dotStrToDate(cashReceiptDate)) {
      toast.error('유효한 현금영수증 발급일을 입력해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      await recordPaymentMutation.mutateAsync({
        documentId,
        type: 'final',
        amount,
        paymentDate: dotStrToIso(paymentDate),
        notes: `${clientName} 잔금 입금`,
        cashReceiptIssued,
        cashReceiptDate: cashReceiptIssued ? dotStrToIso(cashReceiptDate) : null,
      });
      await utils.documents.list.invalidate();
      await utils.documents.getPayments.invalidate({ documentId });
      await utils.sales.getMonthly.invalidate();
      await utils.clients.list.invalidate();
      toast.success('잔금이 확정되었습니다.');
      onClose();
      onSuccess?.();
    } catch {
      toast.error('잔금 확정에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>잔금 확정</DialogTitle>
          <DialogDescription>{clientName} 고객사의 잔금을 확정합니다.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">총 계약금액</p>
              <p className="text-sm font-semibold">{totalAmount.toLocaleString('ko-KR')}원</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">기납부 계약금</p>
              <p className="text-sm font-semibold">{depositAmount.toLocaleString('ko-KR')}원</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="final-amount">잔금 금액 (기본값: 잔여분)</Label>
            <Input
              id="final-amount"
              type="text"
              value={finalAmount ? Number(finalAmount.replace(/,/g, '')).toLocaleString('ko-KR') : ''}
              onChange={e => setFinalAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="잔금을 입력하세요"
              className="text-right"
            />
            <p className="text-xs text-muted-foreground">
              입금 후 총 수령액: {(depositAmount + Number(finalAmount.replace(/,/g, '') || 0)).toLocaleString('ko-KR')}원
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

          <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
            <Label htmlFor="final-cash-receipt" className="cursor-pointer">현금영수증 발급</Label>
            <Switch id="final-cash-receipt" checked={cashReceiptIssued} onCheckedChange={setCashReceiptIssued} />
          </div>

          {cashReceiptIssued && (
            <div className="space-y-2">
              <Label>현금영수증 발급일</Label>
              <div className="flex gap-2">
                <Input
                  value={cashReceiptDate}
                  onChange={e => handleCashReceiptDateInput(e.target.value)}
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
                      selected={dotStrToDate(cashReceiptDate)}
                      onSelect={date => {
                        if (!date) return;
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        setCashReceiptDate(`${y}.${m}.${d}`);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { setFinalAmount(remaining.toString()); setPaymentDate(todayDotStr()); setCashReceiptIssued(false); setCashReceiptDate(todayDotStr()); }} disabled={isLoading}>
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
