import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ko } from 'date-fns/locale';
import { CalendarDays, Loader2, Pencil, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface PaymentEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: number;
  type: 'deposit' | 'final';
  clientName: string;
  onChanged?: () => void;
}

function dotStrToDate(str: string): Date | undefined {
  const parts = str.split('.');
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return undefined;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? undefined : date;
}

function isoToDotStr(iso: string): string {
  return iso.replace(/-/g, '.');
}

function dotStrToIso(str: string): string {
  const parts = str.split('.');
  if (parts.length !== 3) return str;
  return `${parts[0]}-${parts[1]}-${parts[2]}`;
}

export default function PaymentEditDialog({ isOpen, onClose, documentId, type, clientName, onChanged }: PaymentEditDialogProps) {
  const utils = trpc.useUtils();
  const { data: payments = [], isLoading } = trpc.documents.getPayments.useQuery({ documentId }, { enabled: isOpen });
  const list = payments.filter((p) => p.type === type);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftAmount, setDraftAmount] = useState('');
  const [draftDate, setDraftDate] = useState('');

  const invalidateAll = async () => {
    await Promise.all([
      utils.documents.getPayments.invalidate({ documentId }),
      utils.documents.getDepositedDocumentIds.invalidate(),
      utils.documents.getFinalPaidDocumentIds.invalidate(),
      utils.documents.list.invalidate(),
      utils.clients.list.invalidate(),
      utils.sales.getMonthly.invalidate(),
    ]);
    onChanged?.();
  };

  const updateMutation = trpc.sales.updatePayment.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      setEditingId(null);
      toast.success('입금 기록이 수정되었습니다.');
    },
    onError: () => toast.error('입금 기록 수정에 실패했습니다.'),
  });

  const deleteMutation = trpc.sales.deletePayment.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      toast.success('입금 기록이 삭제되었습니다.');
    },
    onError: () => toast.error('입금 기록 삭제에 실패했습니다.'),
  });

  const startEdit = (id: number, amount: number, paymentDate: string) => {
    setEditingId(id);
    setDraftAmount(String(amount));
    setDraftDate(isoToDotStr(paymentDate));
  };

  const handleDateInput = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 4) + '.' + digits.slice(4);
    if (digits.length > 6) formatted = digits.slice(0, 4) + '.' + digits.slice(4, 6) + '.' + digits.slice(6);
    setDraftDate(formatted);
  };

  const handleSave = () => {
    const amount = Math.round(Number(draftAmount));
    if (draftAmount === '' || isNaN(amount)) {
      toast.error('유효한 금액을 입력해주세요.');
      return;
    }
    if (!dotStrToDate(draftDate)) {
      toast.error('유효한 날짜를 입력해주세요.');
      return;
    }
    if (editingId == null) return;
    updateMutation.mutate({ id: editingId, amount, paymentDate: dotStrToIso(draftDate) });
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('이 입금 기록을 삭제하시겠습니까?')) return;
    deleteMutation.mutate({ id });
  };

  const label = type === 'deposit' ? '계약금' : '잔금';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{label} 입금 기록 수정</DialogTitle>
          <DialogDescription>{clientName} 고객사의 {label} 입금 기록을 수정하거나 삭제할 수 있습니다.</DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2 max-h-[50vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">입금 기록이 없습니다.</p>
          ) : (
            list.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-md border border-input px-3 py-2">
                {editingId === p.id ? (
                  <>
                    <Input
                      value={draftDate}
                      onChange={(e) => handleDateInput(e.target.value)}
                      placeholder="20260608"
                      maxLength={10}
                      className="h-8 text-xs w-28"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="h-8 w-8 flex items-center justify-center rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0">
                          <CalendarDays className="w-4 h-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          locale={ko}
                          selected={dotStrToDate(draftDate)}
                          defaultMonth={dotStrToDate(draftDate) ?? new Date()}
                          onSelect={(date) => {
                            if (!date) return;
                            const y = date.getFullYear();
                            const m = String(date.getMonth() + 1).padStart(2, '0');
                            const d = String(date.getDate()).padStart(2, '0');
                            setDraftDate(`${y}.${m}.${d}`);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      value={draftAmount ? Number(draftAmount).toLocaleString('ko-KR') : ''}
                      onChange={(e) => setDraftAmount(e.target.value.replace(/[^0-9]/g, ''))}
                      className="h-8 text-xs text-right flex-1"
                    />
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditingId(null)} disabled={updateMutation.isPending}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" className="h-8 w-8 p-0" onClick={handleSave} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{isoToDotStr(p.paymentDate)}</span>
                    <span className="text-sm font-semibold flex-1 text-right">{p.amount.toLocaleString('ko-KR')}원</span>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => startEdit(p.id, p.amount, p.paymentDate)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600" onClick={() => handleDelete(p.id)} disabled={deleteMutation.isPending}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
