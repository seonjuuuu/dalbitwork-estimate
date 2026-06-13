import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { GripVertical, ExternalLink, CheckCircle2 } from 'lucide-react';

// ─── Column config ────────────────────────────────────────────────

type WorkflowStatus = '상담' | '진행대기' | '작업진행중' | 'PC검수' | '모바일작업중' | '고객전달' | '완료';

const ALL_COLUMNS: { id: WorkflowStatus; label: string; color: string; dot: string }[] = [
  { id: '진행대기',   label: '진행 대기',               color: 'bg-slate-100 dark:bg-slate-800/60',   dot: 'bg-slate-400' },
  { id: '작업진행중', label: '작업 진행중',             color: 'bg-blue-50 dark:bg-blue-900/20',      dot: 'bg-blue-500' },
  { id: 'PC검수',     label: 'PC ver 검수 및 수정',     color: 'bg-violet-50 dark:bg-violet-900/20',  dot: 'bg-violet-500' },
  { id: '모바일작업중',label: '모바일 ver 작업중',      color: 'bg-sky-50 dark:bg-sky-900/20',        dot: 'bg-sky-500' },
  { id: '고객전달',   label: '고객 전달',               color: 'bg-amber-50 dark:bg-amber-900/20',    dot: 'bg-amber-500' },
  { id: '완료',       label: '완료',                    color: 'bg-emerald-50 dark:bg-emerald-900/20',dot: 'bg-emerald-500' },
];

// ─── Types ────────────────────────────────────────────────────────

interface KanbanClient {
  id: number;
  name: string;
  contactName: string;
  contractAmount: number;
  workflowStatus: WorkflowStatus;
  workflowCompletedAt: Date | string | null;
  status: string | null;
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function isArchivedComplete(client: KanbanClient) {
  if (client.workflowStatus !== '완료') return false;
  if (!client.workflowCompletedAt) return false;
  return Date.now() - new Date(client.workflowCompletedAt).getTime() > THREE_DAYS_MS;
}

// ─── Card ─────────────────────────────────────────────────────────

function KanbanCard({ client, isDragging }: { client: KanbanClient; isDragging?: boolean }) {
  const [, navigate] = useLocation();
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: client.id });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border border-border rounded-lg p-3 shadow-sm select-none ${isDragging ? 'opacity-0' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-sm font-semibold text-foreground truncate">{client.name}</p>
            <button
              onClick={() => navigate(`/clients/${client.id}`)}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          {client.contactName && (
            <p className="text-xs text-muted-foreground mt-0.5">{client.contactName}</p>
          )}
          {client.contractAmount > 0 && (
            <p className="text-xs font-medium text-foreground/70 mt-1">
              {client.contractAmount.toLocaleString('ko-KR')}원
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DragCard({ client }: { client: KanbanClient }) {
  return (
    <div className="bg-card border border-primary/40 rounded-lg p-3 shadow-xl rotate-1 opacity-95 w-48">
      <p className="text-sm font-semibold text-foreground truncate">{client.name}</p>
      {client.contactName && (
        <p className="text-xs text-muted-foreground mt-0.5">{client.contactName}</p>
      )}
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────

function KanbanColumn({
  col,
  clients,
  draggingId,
}: {
  col: typeof ALL_COLUMNS[number];
  clients: KanbanClient[];
  draggingId: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div className="flex flex-col min-w-[180px] max-w-[220px] flex-1">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`} />
        <span className="text-xs font-semibold text-foreground leading-tight">{col.label}</span>
        <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {clients.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl p-2 space-y-2 min-h-[120px] transition-colors ${col.color} ${
          isOver ? 'ring-2 ring-primary/40' : ''
        }`}
      >
        {clients.map(c => (
          <KanbanCard key={c.id} client={c} isDragging={draggingId === c.id} />
        ))}
      </div>
    </div>
  );
}

// ─── Completed list ───────────────────────────────────────────────

function CompletedList({ clients }: { clients: KanbanClient[] }) {
  const [, navigate] = useLocation();
  if (clients.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        <span className="text-sm font-semibold text-foreground">완료</span>
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{clients.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {clients.map(c => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-muted/40 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground truncate">{c.name}</p>
              {c.contactName && <p className="text-xs text-muted-foreground truncate">{c.contactName}</p>}
              {c.workflowCompletedAt && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  완료 {new Date(c.workflowCompletedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
            <button
              onClick={() => navigate(`/clients/${c.id}`)}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────

export default function KanbanBoard({ hide }: { hide?: WorkflowStatus[] } = {}) {
  const COLUMNS = hide ? ALL_COLUMNS.filter(c => !hide.includes(c.id)) : ALL_COLUMNS;
  const { data: rawClients = [], refetch } = trpc.kanban.getClients.useQuery();
  const updateStatusMutation = trpc.kanban.updateStatus.useMutation();
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [optimistic, setOptimistic] = useState<Record<number, WorkflowStatus>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const allClients: KanbanClient[] = rawClients.map(c => ({
    ...c,
    workflowStatus: (optimistic[c.id] ?? c.workflowStatus ?? '상담') as WorkflowStatus,
  }));

  // 3일 경과 완료 → 하단 리스트, 나머지 → 컬럼
  const { activeClients, archivedClients } = useMemo(() => ({
    activeClients: allClients.filter(c => !isArchivedComplete(c)),
    archivedClients: allClients.filter(c => isArchivedComplete(c)),
  }), [allClients]);

  const draggingClient = draggingId ? activeClients.find(c => c.id === draggingId) : null;

  const handleDragStart = (e: DragStartEvent) => {
    setDraggingId(e.active.id as number);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = e;
    if (!over) return;
    const clientId = active.id as number;
    const newStatus = over.id as WorkflowStatus;
    const current = activeClients.find(c => c.id === clientId);
    if (!current || current.workflowStatus === newStatus) return;

    setOptimistic(prev => ({ ...prev, [clientId]: newStatus }));
    try {
      await updateStatusMutation.mutateAsync({ id: clientId, workflowStatus: newStatus });
      await refetch();
    } catch {
      setOptimistic(prev => { const next = { ...prev }; delete next[clientId]; return next; });
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  return (
    <div>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              col={col}
              clients={activeClients.filter(c => c.workflowStatus === col.id)}
              draggingId={draggingId}
            />
          ))}
        </div>
        <DragOverlay>
          {draggingClient ? <DragCard client={draggingClient} /> : null}
        </DragOverlay>
      </DndContext>

      <CompletedList clients={archivedClients} />
    </div>
  );
}
