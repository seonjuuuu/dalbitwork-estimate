import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Plus, Trash2, Loader2, ListTodo, Building2, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';

const PRIORITY_LABEL: Record<string, { label: string; cls: string }> = {
  high: { label: '높음', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  medium: { label: '보통', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  low: { label: '낮음', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400' },
};
const PRIORITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

export default function TodoList() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: todos = [], isLoading } = trpc.todos.list.useQuery();
  const { data: clients = [] } = trpc.clients.list.useQuery(undefined);
  const createMutation = trpc.todos.create.useMutation();
  const updateMutation = trpc.todos.update.useMutation();
  const deleteMutation = trpc.todos.delete.useMutation();

  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [clientId, setClientId] = useState<string>('none');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const selectedClientName = clientId === 'none' ? null : clients.find((c) => String(c.id) === clientId)?.name ?? null;
  const q = clientSearch.trim().toLowerCase();
  // 검색 안 할 땐 완료된 고객사는 목록에서 숨기고, 검색하면 완료된 고객사도 찾을 수 있게
  const clientOptions = q
    ? clients.filter((c) => c.name.toLowerCase().includes(q))
    : clients.filter((c) => c.status !== '완료');

  const invalidate = () => utils.todos.list.invalidate();

  const handleAdd = async () => {
    if (!content.trim()) {
      toast.error('할 일 내용을 입력해주세요.');
      return;
    }
    setAdding(true);
    try {
      await createMutation.mutateAsync({
        content: content.trim(),
        priority,
        clientId: clientId === 'none' ? null : Number(clientId),
      });
      setContent('');
      setPriority('medium');
      setClientId('none');
      setClientSearch('');
      await invalidate();
    } catch {
      toast.error('추가에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: number, completed: boolean) => {
    setBusyId(id);
    try {
      await updateMutation.mutateAsync({ id, completed: !completed });
      await invalidate();
    } catch {
      toast.error('변경에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setBusyId(id);
    try {
      await deleteMutation.mutateAsync({ id });
      await invalidate();
    } catch {
      toast.error('삭제에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const activeTodos = todos
    .filter((t) => !t.completed)
    .sort(
      (a, b) =>
        PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  const completedTodos = todos.filter((t) => t.completed);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <ListTodo className="w-4 h-4 text-muted-foreground" />
        할 일
        {activeTodos.length > 0 && <span className="text-xs text-muted-foreground font-normal">({activeTodos.length}건)</span>}
      </h2>

      {/* 추가 폼 */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="할 일을 입력하세요..."
          className="flex-1 h-9 text-sm"
        />
        <Select value={priority} onValueChange={(v) => setPriority(v as 'low' | 'medium' | 'high')}>
          <SelectTrigger size="sm" className="w-full sm:w-[90px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="high">높음</SelectItem>
            <SelectItem value="medium">보통</SelectItem>
            <SelectItem value="low">낮음</SelectItem>
          </SelectContent>
        </Select>
        <Popover open={clientPickerOpen} onOpenChange={(open) => { setClientPickerOpen(open); if (!open) setClientSearch(''); }}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-[160px] h-9 justify-between font-normal text-sm"
            >
              <span className="truncate">{selectedClientName ?? '고객사 없음'}</span>
              <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="고객사 검색..." value={clientSearch} onValueChange={setClientSearch} />
              <CommandList>
                <CommandItem
                  onSelect={() => { setClientId('none'); setClientPickerOpen(false); setClientSearch(''); }}
                >
                  {clientId === 'none' && <Check className="w-3.5 h-3.5 mr-1" />}
                  고객사 없음
                </CommandItem>
                {clientOptions.length === 0 ? (
                  <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                ) : (
                  <CommandGroup>
                    {clientOptions.map((c) => (
                      <CommandItem
                        key={c.id}
                        onSelect={() => { setClientId(String(c.id)); setClientPickerOpen(false); setClientSearch(''); }}
                      >
                        {clientId === String(c.id) && <Check className="w-3.5 h-3.5 mr-1" />}
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground mr-1" />
                        {c.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button size="sm" onClick={handleAdd} disabled={adding} className="h-9 gap-1">
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          추가
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : activeTodos.length === 0 && completedTodos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">할 일이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {activeTodos.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic py-2">진행 중인 할 일이 없습니다.</p>
          ) : (
            activeTodos.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 bg-muted/20 border border-border rounded-lg group">
                <button
                  onClick={() => handleToggle(t.id, t.completed)}
                  disabled={busyId === t.id}
                  className="w-4 h-4 rounded border border-input flex-shrink-0 hover:border-primary transition-colors"
                />
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_LABEL[t.priority].cls}`}>
                  {PRIORITY_LABEL[t.priority].label}
                </span>
                <span className="text-sm text-foreground flex-1 truncate">{t.content}</span>
                {t.clientName && (
                  <button
                    onClick={() => navigate(`/clients/${t.clientId}`)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary flex-shrink-0"
                  >
                    <Building2 className="w-3 h-3" />
                    {t.clientName}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={busyId === t.id}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {busyId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))
          )}

          {completedTodos.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                완료됨 {completedTodos.length}건 {showCompleted ? '숨기기' : '보기'}
              </button>
              {showCompleted && (
                <div className="space-y-1.5 mt-1.5">
                  {completedTodos.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 px-3 py-2 bg-muted/10 border border-border/60 rounded-lg group">
                      <button
                        onClick={() => handleToggle(t.id, t.completed)}
                        disabled={busyId === t.id}
                        className="w-4 h-4 rounded border border-primary bg-primary flex items-center justify-center flex-shrink-0"
                      >
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </button>
                      <span className="text-sm text-muted-foreground line-through flex-1 truncate">{t.content}</span>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={busyId === t.id}
                        className="text-muted-foreground hover:text-destructive flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {busyId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
