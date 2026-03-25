import { useEstimate } from '@/contexts/EstimateContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Save, GripVertical, Tag, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { getDocTypeLabel, autoFormatNumber, calcTotalOriginal, calcTotalFinal, calcTotalDiscount, hasAnyDiscount } from '@/lib/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 숫자 입력 핸들러 - 입력 시 자동 콤마
function handleNumberInput(value: string, callback: (formatted: string) => void) {
  const formatted = autoFormatNumber(value);
  callback(formatted);
}

// 드래그 가능한 참고사항 아이템
function SortableNoteItem({
  id,
  index,
  note,
  onUpdate,
  onRemove,
}: {
  id: string;
  index: number;
  note: string;
  onUpdate: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 group">
      <button
        {...attributes}
        {...listeners}
        className="w-6 flex-shrink-0 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <span className="text-xs text-muted-foreground w-5 flex-shrink-0 pt-2.5">{index + 1}.</span>
      <textarea
        value={note}
        onChange={(e) => onUpdate(index, e.target.value)}
        rows={Math.max(1, Math.ceil(note.length / 50))}
        className="flex-1 text-sm bg-background border border-input rounded-md px-3 py-2 resize-y min-h-[36px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
        placeholder="참고 사항 또는 계약 조항을 입력하세요..."
      />
      <button
        onClick={() => onRemove(index)}
        className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-0.5"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function EstimateForm() {
  const {
    currentDoc,
    setCurrentDoc,
    addItem,
    removeItem,
    updateItem,
    addNote,
    removeNote,
    updateNote,
    reorderNotes,
    saveDocument,
  } = useEstimate();

  const docLabel = getDocTypeLabel(currentDoc.type);
  const isProposal = currentDoc.type === 'proposal';

  const updateField = (field: string, value: string | number) => {
    setCurrentDoc((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!currentDoc.clientName.trim()) {
      toast.error('수신처(고객사명)를 입력해주세요.');
      return;
    }
    saveDocument();
    toast.success(`${docLabel}가 저장되었습니다.`);
  };

  // 자동 계산
  const totalOriginal = calcTotalOriginal(currentDoc.items);
  const totalFinal = calcTotalFinal(currentDoc.items);
  const totalDiscount = calcTotalDiscount(currentDoc.items);
  const showDiscount = hasAnyDiscount(currentDoc.items);
  const discountPercent = totalOriginal > 0 ? Math.round((totalDiscount / totalOriginal) * 100) : 0;

  // 드래그앤드롭 센서
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 참고사항 ID 생성 (인덱스 기반)
  const noteIds = currentDoc.notes.map((_: string, i: number) => `note-${i}`);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = noteIds.indexOf(String(active.id));
      const newIndex = noteIds.indexOf(String(over.id));
      reorderNotes(oldIndex, newIndex);
    }
  };

  return (
    <div className="space-y-6">
      {/* Document Type Badge */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
            isProposal
              ? 'bg-amber-100 text-amber-800 border border-amber-200'
              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
          }`}
        >
          {isProposal ? '제안서 (대략 견적)' : '견적서 (확정 견적)'}
        </span>
      </div>

      {/* 내부 관리용 타이틀 & 메모 */}
      <div className="bg-card rounded-lg border border-dashed border-amber-300/60 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="w-4 h-4 text-[#F7AE00]" />
          <h3 className="text-sm font-semibold text-foreground">내부 관리</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">PDF에 미포함</span>
        </div>
        <div className="grid grid-cols-1 gap-4 mt-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">제목 (내부 관리용)</label>
            <Input
              value={currentDoc.title || ''}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="예: 시나몬랩 홈페이지 리뉴얼 1차 제안"
              className="bg-background"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <StickyNote className="w-3 h-3" />
              메모 (내부 관리용)
            </label>
            <textarea
              value={currentDoc.memo || ''}
              onChange={(e) => updateField('memo', e.target.value)}
              rows={2}
              className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 resize-y min-h-[60px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              placeholder="내부 메모를 입력하세요... (예: 담당자 연락처, 특이사항 등)"
            />
          </div>
        </div>
      </div>

      {/* Header Info */}
      <div className="bg-card rounded-lg border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 section-title">기본 정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">수신처 (고객사)</label>
            <Input
              value={currentDoc.clientName}
              onChange={(e) => updateField('clientName', e.target.value)}
              placeholder="주식회사 OOO 귀중"
              className="bg-background"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">프로젝트명</label>
            <Input
              value={currentDoc.projectName}
              onChange={(e) => updateField('projectName', e.target.value)}
              placeholder="홈페이지 리뉴얼 (국/영문)"
              className="bg-background"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">플랫폼</label>
            <Input
              value={currentDoc.platform}
              onChange={(e) => updateField('platform', e.target.value)}
              placeholder="아임웹(I'mweb)"
              className="bg-background"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">발행일</label>
            <Input
              type="date"
              value={currentDoc.date}
              onChange={(e) => updateField('date', e.target.value)}
              className="bg-background"
            />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-card rounded-lg border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground section-title">{docLabel} 항목</h3>
          <Button variant="outline" size="sm" onClick={addItem} className="text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            항목 추가
          </Button>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[2fr_0.8fr_1.2fr_1.2fr_auto] gap-2 mb-2 mt-5">
          <span className="text-[11px] font-medium text-muted-foreground px-1">항목명</span>
          <span className="text-[11px] font-medium text-muted-foreground px-1">수량</span>
          <span className="text-[11px] font-medium text-muted-foreground px-1">정가(원)</span>
          <span className="text-[11px] font-medium text-muted-foreground px-1">할인가(원)</span>
          <span className="w-8" />
        </div>

        {/* Items */}
        <div className="space-y-2">
          {currentDoc.items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[2fr_0.8fr_1.2fr_1.2fr_auto] gap-2 items-center group"
            >
              <Input
                value={item.name}
                onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                placeholder="항목명"
                className="text-sm bg-background h-9"
              />
              <Input
                value={item.quantity}
                onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                placeholder="1페이지"
                className="text-sm bg-background h-9"
              />
              <Input
                value={item.originalPrice}
                onChange={(e) => handleNumberInput(e.target.value, (v) => updateItem(item.id, 'originalPrice', v))}
                placeholder="900,000"
                className="text-sm bg-background h-9 amount"
              />
              <Input
                value={item.discountPrice}
                onChange={(e) => handleNumberInput(e.target.value, (v) => updateItem(item.id, 'discountPrice', v))}
                placeholder="할인가 (선택)"
                className="text-sm bg-background h-9 amount"
              />
              <button
                onClick={() => removeItem(item.id)}
                className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* 자동 계산 요약 - 할인색상 골드(#F7AE00) */}
        {showDiscount && (
          <div className="mt-4 p-3 bg-[#F7AE00]/5 border border-[#F7AE00]/20 rounded-lg">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">총 정가</span>
              <span className="line-through text-muted-foreground amount">{totalOriginal.toLocaleString('ko-KR')}원</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-[#F7AE00] font-semibold">총 할인 ({discountPercent}%)</span>
              <span className="text-[#F7AE00] font-semibold amount">-{totalDiscount.toLocaleString('ko-KR')}원</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1 pt-1 border-t border-[#F7AE00]/20">
              <span className="font-semibold text-foreground">할인 적용 금액</span>
              <span className="font-bold text-foreground amount">{totalFinal.toLocaleString('ko-KR')}원</span>
            </div>
          </div>
        )}
      </div>

      {/* Total */}
      <div className="bg-card rounded-lg border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 section-title">
          {isProposal ? '예상 총액' : '확정 총액'}
        </h3>

        <p className="text-[11px] text-muted-foreground mb-3 mt-2">
          위 항목의 합계가 자동 반영됩니다. 필요 시 직접 수정할 수 있습니다.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {isProposal ? (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">최종 최소 금액 (원)</label>
                <Input
                  type="number"
                  value={currentDoc.totalMin}
                  onChange={(e) => updateField('totalMin', Number(e.target.value))}
                  placeholder="2000000"
                  className="bg-background amount"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">최종 최대 금액 (원)</label>
                <Input
                  type="number"
                  value={currentDoc.totalMax}
                  onChange={(e) => updateField('totalMax', Number(e.target.value))}
                  placeholder="2250000"
                  className="bg-background amount"
                />
              </div>
            </>
          ) : (
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">최종 확정 금액 (원)</label>
              <Input
                type="number"
                value={currentDoc.totalMin}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  updateField('totalMin', val);
                  updateField('totalMax', val);
                }}
                placeholder="2125000"
                className="bg-background amount"
              />
            </div>
          )}
        </div>
      </div>

      {/* Notes with Drag and Drop */}
      <div className="bg-card rounded-lg border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground section-title">참고 사항</h3>
          <Button variant="outline" size="sm" onClick={addNote} className="text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            추가
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3 mt-2">
          드래그하여 순서를 변경할 수 있습니다. 계약 조항, 작업 범위, 결제 조건 등을 자유롭게 입력하세요.
        </p>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={noteIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 mt-3">
              {currentDoc.notes.map((note: string, idx: number) => (
                <SortableNoteItem
                  key={noteIds[idx]}
                  id={noteIds[idx]}
                  index={idx}
                  note={note}
                  onUpdate={updateNote}
                  onRemove={removeNote}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Save className="w-4 h-4" />
          저장하기
        </Button>
      </div>
    </div>
  );
}
