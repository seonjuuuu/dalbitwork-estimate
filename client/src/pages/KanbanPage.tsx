import KanbanBoard from '@/components/KanbanBoard';

export default function KanbanPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">프로젝트 진행 현황</h1>
        <p className="text-sm text-muted-foreground mt-1">작업 중인 프로젝트를 드래그로 이동하세요</p>
      </div>
      <KanbanBoard />
    </div>
  );
}
