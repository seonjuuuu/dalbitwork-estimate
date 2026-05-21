import { useEstimate } from '@/contexts/EstimateContext';
import { nanoid } from 'nanoid';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Save, GripVertical, Tag, StickyNote, Loader2, BookOpen, BookmarkPlus, Download, Replace, List, FileText, Variable, Boxes, Gift } from 'lucide-react';
import ServiceItemPicker from '@/components/ServiceItemPicker';
import ClientAutocomplete from '@/components/ClientAutocomplete';
import { trpc } from '@/lib/trpc';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import type { NotesMode } from '@/lib/types';
import {
  extractVariables,
  buildVariablesMap,
  isAmountVariable,
  formatAmountWithComma,
  parseAmountString,
  calculateAmounts,
  getPresetValue,
} from '@/lib/templateVariables';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { getDocTypeLabel, autoFormatNumber, parseAmount, calcTotalOriginal, calcTotalFinal, calcTotalDiscount, hasAnyDiscount } from '@/lib/types';
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

// 스마트 변수 입력 그리드 컴포넌트
function VariableInputGrid({
  detectedVariables,
  templateVariables,
  onVariableChange,
}: {
  detectedVariables: string[];
  templateVariables: Record<string, string>;
  onVariableChange: (varName: string, value: string) => void;
}) {
  // 총금액 변수가 있는지 확인
  const hasTotalAmount = detectedVariables.includes('총금액');
  const hasDeposit = detectedVariables.includes('계약금');
  const hasBalance = detectedVariables.includes('잔금');
  const hasAmountCalc = hasTotalAmount && hasDeposit && hasBalance;

  // 계약금 비율 상태 (50% 기본)
  const [depositRatio, setDepositRatio] = useState(50);

  // 총금액 변경 시 계약금/잔금 자동 계산
  const handleTotalAmountChange = (value: string) => {
    const formatted = formatAmountWithComma(value);
    onVariableChange('총금액', formatted ? `${formatted}원` : '');
    
    if (formatted) {
      const total = parseAmountString(formatted);
      const { deposit, balance } = calculateAmounts(total, depositRatio);
      if (hasDeposit) onVariableChange('계약금', deposit);
      if (hasBalance) onVariableChange('잔금', balance);
    } else {
      if (hasDeposit) onVariableChange('계약금', '');
      if (hasBalance) onVariableChange('잔금', '');
    }
  };

  // 비율 변경 시 재계산
  const handleRatioChange = (newRatio: number) => {
    setDepositRatio(newRatio);
    const totalStr = templateVariables['총금액'] || '';
    const total = parseAmountString(totalStr);
    if (total > 0) {
      const { deposit, balance } = calculateAmounts(total, newRatio);
      if (hasDeposit) onVariableChange('계약금', deposit);
      if (hasBalance) onVariableChange('잔금', balance);
    }
  };

  // 금액 변수 자동 계산 그룹에 포함되는 변수들
  const autoCalcVars = hasAmountCalc ? ['총금액', '계약금', '잔금'] : [];
  // 일반 변수 (자동 계산 그룹에 포함되지 않는 변수)
  const normalVars = detectedVariables.filter((v) => !autoCalcVars.includes(v));

  return (
    <div className="space-y-4">
      {/* 일반 변수 입력 */}
      {normalVars.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {normalVars.map((varName) => {
            const preset = getPresetValue(varName);
            return (
              <div key={varName}>
                <label className="text-[11px] font-medium text-amber-800 dark:text-amber-200 mb-1 block">
                  {`{{${varName}}}`}
                  {preset && (
                    <span className="ml-1 text-[9px] text-amber-500 font-normal">기본값 적용됨</span>
                  )}
                </label>
                <Input
                  value={templateVariables[varName] || ''}
                  onChange={(e) => onVariableChange(varName, e.target.value)}
                  placeholder={preset || `${varName} 값을 입력하세요`}
                  className="bg-background text-sm h-8"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* 금액 자동 계산 그룹 */}
      {hasAmountCalc && (
        <div className="p-3 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg border border-amber-200/60 dark:border-amber-700/40">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">금액 자동 계산</span>
            <span className="text-[9px] text-amber-600 dark:text-amber-400 bg-amber-200/60 dark:bg-amber-800/40 px-1.5 py-0.5 rounded-full">총금액 입력 시 자동 계산</span>
          </div>

          {/* 총금액 입력 */}
          <div className="mb-3">
            <label className="text-[11px] font-medium text-amber-800 dark:text-amber-200 mb-1 block">
              {`{{총금액}}`}
            </label>
            <div className="flex items-center gap-2">
              <Input
                value={templateVariables['총금액']?.replace(/원$/, '').replace(/,/g, '') || ''}
                onChange={(e) => handleTotalAmountChange(e.target.value)}
                placeholder="650000"
                className="bg-background text-sm h-8 flex-1"
                type="text"
                inputMode="numeric"
              />
              <span className="text-xs text-amber-700 dark:text-amber-300 flex-shrink-0">원</span>
            </div>
          </div>

          {/* 비율 설정 */}
          <div className="mb-3">
            <label className="text-[11px] font-medium text-amber-800 dark:text-amber-200 mb-1 block">
              계약금 / 잔금 비율
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 flex-1">
                <span className="text-[10px] text-amber-700 dark:text-amber-300">계약금</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={depositRatio}
                  onChange={(e) => handleRatioChange(Number(e.target.value))}
                  className="bg-background text-sm h-8 w-16 text-center"
                />
                <span className="text-[10px] text-amber-700 dark:text-amber-300">%</span>
              </div>
              <span className="text-amber-400">:</span>
              <div className="flex items-center gap-1 flex-1">
                <span className="text-[10px] text-amber-700 dark:text-amber-300">잔금</span>
                <Input
                  type="number"
                  value={100 - depositRatio}
                  readOnly
                  className="bg-muted text-sm h-8 w-16 text-center cursor-not-allowed"
                />
                <span className="text-[10px] text-amber-700 dark:text-amber-300">%</span>
              </div>
            </div>
          </div>

          {/* 계산 결과 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-amber-800 dark:text-amber-200 mb-1 block">
                {`{{계약금}}`}
              </label>
              <Input
                value={templateVariables['계약금'] || ''}
                readOnly
                className="bg-muted text-sm h-8 cursor-not-allowed"
                placeholder="자동 계산"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-amber-800 dark:text-amber-200 mb-1 block">
                {`{{잔금}}`}
              </label>
              <Input
                value={templateVariables['잔금'] || ''}
                readOnly
                className="bg-muted text-sm h-8 cursor-not-allowed"
                placeholder="자동 계산"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 참고사항 템플릿 불러오기/저장 컴포넌트
function NoteTemplateActions({
  currentNotes,
  currentMode,
  currentFreeformNotes,
  onApplyTemplate,
}: {
  currentNotes: string[];
  currentMode: NotesMode;
  currentFreeformNotes: string | null;
  onApplyTemplate: (data: { notes: string[]; mode: NotesMode; freeformNotes: string | null }, applyMode: 'replace' | 'append') => void;
}) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: number; name: string; notes: string[]; mode: string; freeformNotes: string | null } | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const templatesQuery = trpc.noteTemplates.list.useQuery();
  const utils = trpc.useUtils();

  const saveMutation = trpc.noteTemplates.saveFromDocument.useMutation({
    onSuccess: () => {
      utils.noteTemplates.list.invalidate();
      setSaveDialogOpen(false);
      setTemplateName('');
      toast.success('템플릿이 저장되었습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const templates = templatesQuery.data || [];

  const handleSaveAsTemplate = () => {
    if (currentMode === 'list') {
      const filteredNotes = currentNotes.filter((n) => n.trim() !== '');
      if (filteredNotes.length === 0) {
        toast.error('저장할 참고사항이 없습니다.');
        return;
      }
    } else {
      if (!currentFreeformNotes?.trim()) {
        toast.error('저장할 참고사항이 없습니다.');
        return;
      }
    }
    setSaveDialogOpen(true);
  };

  const handleConfirmSave = () => {
    if (!templateName.trim()) {
      toast.error('템플릿 이름을 입력해주세요.');
      return;
    }
    const filteredNotes = currentNotes.filter((n) => n.trim() !== '');
    saveMutation.mutate({
      name: templateName.trim(),
      notes: filteredNotes,
      mode: currentMode,
      freeformNotes: currentMode === 'freeform' ? currentFreeformNotes : null,
    });
  };

  const handleSelectTemplate = (tmpl: { id: number; name: string; notes: string[]; mode: string; freeformNotes: string | null }) => {
    setSelectedTemplate(tmpl);
    // If there are existing notes, ask for replace/append
    const hasExisting = currentMode === 'list'
      ? currentNotes.filter((n) => n.trim() !== '').length > 0
      : (currentFreeformNotes?.trim() || '').length > 0;
    if (hasExisting) {
      setConfirmDialogOpen(true);
    } else {
      const mode = (tmpl.mode || 'list') as NotesMode;
      onApplyTemplate({ notes: tmpl.notes, mode, freeformNotes: tmpl.freeformNotes }, 'replace');
      toast.success(`"${tmpl.name}" 템플릿이 적용되었습니다.`);
    }
  };

  const handleConfirmApply = (applyMode: 'replace' | 'append') => {
    if (selectedTemplate) {
      const mode = (selectedTemplate.mode || 'list') as NotesMode;
      onApplyTemplate({ notes: selectedTemplate.notes, mode, freeformNotes: selectedTemplate.freeformNotes }, applyMode);
      toast.success(
        applyMode === 'replace'
          ? `"${selectedTemplate.name}" 템플릿으로 교체되었습니다.`
          : `"${selectedTemplate.name}" 템플릿이 추가되었습니다.`
      );
    }
    setConfirmDialogOpen(false);
    setSelectedTemplate(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            템플릿
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs font-semibold">템플릿 불러오기</DropdownMenuLabel>
          {templates.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              저장된 템플릿이 없습니다.
            </div>
          ) : (
            templates.map((tmpl) => (
              <DropdownMenuItem
                key={tmpl.id}
                onClick={() => handleSelectTemplate(tmpl)}
                className="flex items-center gap-2 cursor-pointer"
              >
                {(tmpl.mode || 'list') === 'freeform' ? (
                  <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                ) : (
                  <BookOpen className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{tmpl.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(tmpl.mode || 'list') === 'freeform' ? '자유형식' : `${tmpl.notes.length}개 항목`}
                  </p>
                </div>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSaveAsTemplate}
            className="flex items-center gap-2 cursor-pointer text-primary"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span className="text-sm">현재 참고사항을 템플릿으로 저장</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save as Template Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>템플릿으로 저장</DialogTitle>
            <DialogDescription>
              현재 참고사항을 템플릿으로 저장합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">템플릿 이름</label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="예: 기본 계약 조항, 아임웹 제작 약관"
                className="bg-background"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmSave();
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {currentMode === 'list'
                ? `${currentNotes.filter((n) => n.trim() !== '').length}개의 참고사항이 저장됩니다.`
                : '자유형식 참고사항이 저장됩니다.'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(false)}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSave}
              disabled={saveMutation.isPending}
              className="gap-1.5"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Mode Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>템플릿 적용 방식</DialogTitle>
            <DialogDescription>
              현재 참고사항이 있습니다. 어떻게 적용하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Button
              variant="outline"
              onClick={() => handleConfirmApply('replace')}
              className="justify-start gap-3 h-auto py-3 px-4"
            >
              <Replace className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium">교체하기</p>
                <p className="text-xs text-muted-foreground">현재 참고사항을 삭제하고 템플릿으로 교체합니다</p>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={() => handleConfirmApply('append')}
              className="justify-start gap-3 h-auto py-3 px-4"
            >
              <Download className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium">추가하기</p>
                <p className="text-xs text-muted-foreground">현재 참고사항 뒤에 템플릿을 추가합니다</p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
    isSaving,
  } = useEstimate();

  const docLabel = getDocTypeLabel(currentDoc.type);
  const isProposal = currentDoc.type === 'proposal';

  const updateField = (field: string, value: string | number) => {
    setCurrentDoc((prev) => ({ ...prev, [field]: value }));
  };

  const [servicePickerOpen, setServicePickerOpen] = useState(false);

  const handleAddServiceItem = (item: { name: string; unitPrice: string; originalPrice: string }) => {
    setCurrentDoc((prev) => ({
      ...prev,
      items: [...prev.items, { id: nanoid(), name: item.name, quantity: '1', unitPrice: item.unitPrice, originalPrice: item.originalPrice, discountPrice: '', discountAmount: '' }],
    }));
  };

  const upsertClientMutation = trpc.clients.upsertFromDocument.useMutation();

  const handleSave = async () => {
    if (!currentDoc.clientName.trim()) {
      toast.error('수신처(고객사명)를 입력해주세요.');
      return;
    }
    try {
      await saveDocument();
      toast.success(`${docLabel}가 저장되었습니다.`);
      // 고객사 자동 등록
      if (currentDoc.clientName.trim()) {
        const isEstimate = currentDoc.type === 'estimate';
        upsertClientMutation.mutate({
          name: currentDoc.clientName.trim(),
          contactName: currentDoc.contactName || '',
          contactPhone: currentDoc.contactPhone || '',
          isEstimate,
          ...(isEstimate && {
            contractDate: currentDoc.date || '',
            contractAmount: currentDoc.totalMin || 0,
          }),
        });
      }
    } catch (err) {
      toast.error('저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // 자동 계산
  const totalOriginal = calcTotalOriginal(currentDoc.items);
  const totalFinal = calcTotalFinal(currentDoc.items);
  const totalDiscount = calcTotalDiscount(currentDoc.items);
  const showDiscount = hasAnyDiscount(currentDoc.items);
  const discountPercent = totalOriginal > 0 ? Math.round((totalDiscount / totalOriginal) * 100) : 0;

  // 예산 범위 자동계산 (항목 변경 시)
  useEffect(() => {
    const baseAmount = showDiscount ? totalFinal : totalOriginal;
    
    if (baseAmount > 0) {
      if (isProposal) {
        // 제안서: ±10% 범위
        const minBudget = Math.round(baseAmount * 0.9);
        const maxBudget = Math.round(baseAmount * 1.1);
        setCurrentDoc((prev) => {
          // 항상 자동 계산
          return { ...prev, totalMin: minBudget, totalMax: maxBudget };
        });
      } else {
        // 견적서: 정가 또는 할인가 기준
        setCurrentDoc((prev) => {
          // 항상 자동 계산
          return { ...prev, totalMin: baseAmount, totalMax: baseAmount };
        });
      }
    }
  }, [totalOriginal, totalFinal, showDiscount, isProposal, setCurrentDoc]);

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

  // 참고사항 모드 전환
  const handleNotesMode = (mode: NotesMode) => {
    setCurrentDoc((prev) => ({ ...prev, notesMode: mode }));
  };

  // 자유형식 텍스트 업데이트
  const handleFreeformNotesChange = (value: string) => {
    setCurrentDoc((prev) => {
      // Auto-detect variables and update templateVariables map
      const vars = extractVariables(value);
      const newVarsMap = vars.length > 0
        ? buildVariablesMap(vars, prev.templateVariables)
        : null;
      return { ...prev, freeformNotes: value, templateVariables: newVarsMap };
    });
  };

  // 변수 값 업데이트
  const handleVariableChange = (varName: string, value: string) => {
    setCurrentDoc((prev) => ({
      ...prev,
      templateVariables: {
        ...(prev.templateVariables || {}),
        [varName]: value,
      },
    }));
  };

  // 현재 감지된 변수 목록
  const detectedVariables = currentDoc.notesMode === 'freeform'
    ? extractVariables(currentDoc.freeformNotes || '')
    : [];

  // 템플릿 적용 핸들러 (모드 포함)
  const handleApplyTemplate = (
    data: { notes: string[]; mode: NotesMode; freeformNotes: string | null },
    applyMode: 'replace' | 'append'
  ) => {
    if (applyMode === 'replace') {
      setCurrentDoc((prev) => ({
        ...prev,
        notes: data.notes,
        notesMode: data.mode,
        freeformNotes: data.freeformNotes,
      }));
    } else {
      // append
      if (data.mode === 'freeform') {
        // 자유형식 템플릿을 추가할 때
        if (currentDoc.notesMode === 'freeform') {
          setCurrentDoc((prev) => ({
            ...prev,
            freeformNotes: (prev.freeformNotes || '') + '\n\n' + (data.freeformNotes || ''),
          }));
        } else {
          // 리스트 모드에서 자유형식 추가 → 자유형식으로 전환
          setCurrentDoc((prev) => ({
            ...prev,
            notesMode: 'freeform',
            freeformNotes: data.freeformNotes,
          }));
        }
      } else {
        // 리스트 템플릿 추가
        if (currentDoc.notesMode === 'list') {
          setCurrentDoc((prev) => ({
            ...prev,
            notes: [...prev.notes, ...data.notes],
          }));
        } else {
          // 자유형식 모드에서 리스트 추가 → 리스트로 전환
          setCurrentDoc((prev) => ({
            ...prev,
            notesMode: 'list',
            notes: data.notes,
          }));
        }
      }
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
          {isProposal ? '제안서 (대략 견적)' : '견적 및 계약서 (확정 견적)'}
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
              rows={5}
              className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 resize-y min-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
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
            <ClientAutocomplete
              value={currentDoc.clientName}
              onChange={(v) => updateField('clientName', v)}
              onSelect={(client) => {
                updateField('clientName', client.name);
                if (client.contactName) updateField('contactName', client.contactName);
                if (client.contactPhone) updateField('contactPhone', client.contactPhone);
              }}
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
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">담당자 이름</label>
            <Input
              value={currentDoc.contactName}
              onChange={(e) => updateField('contactName', e.target.value)}
              placeholder="홍길동"
              className="bg-background"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">담당자 연락처</label>
            <Input
              value={currentDoc.contactPhone}
              onChange={(e) => updateField('contactPhone', e.target.value)}
              placeholder="010-1234-5678"
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

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">업종</label>
            <Input
              value={currentDoc.businessType}
              onChange={(e) => updateField('businessType', e.target.value)}
              placeholder="쇼핑몰, 서비스업 등"
              className="bg-background"
            />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-card rounded-lg border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground section-title">{docLabel} 항목</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setServicePickerOpen(true)} className="text-xs gap-1.5">
              <Boxes className="w-3.5 h-3.5" />
              서비스 추가
            </Button>
            <Button variant="outline" size="sm" onClick={addItem} className="text-xs gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              직접 추가
            </Button>
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.8fr_0.8fr_auto] gap-1.5 mb-2 mt-5 overflow-x-auto">
          <span className="text-[11px] font-medium text-muted-foreground px-1">항목명</span>
          <span className="text-[11px] font-medium text-muted-foreground px-1">수량</span>
          <span className="text-[11px] font-medium text-muted-foreground px-1">단가(원)</span>
          <span className="text-[11px] font-medium text-muted-foreground px-1">정가(원)</span>
          <span className="text-[11px] font-medium text-muted-foreground px-1">할인금액(원)</span>
          <span className="text-[11px] font-medium text-muted-foreground px-1">할인가(원)</span>
          <span className="w-8" />
        </div>

        {/* Items */}
        <div className="space-y-2">
          {currentDoc.items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.8fr_0.8fr_auto] gap-1.5 items-center group"
            >
              <Input
                value={item.name}
                onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                placeholder="항목명"
                className="text-sm bg-background h-9"
              />
              <Input
                type="number"
                value={item.quantity}
                onChange={(e) => {
                  const newQty = e.target.value.replace(/[^0-9]/g, '');
                  updateItem(item.id, 'quantity', newQty);
                  // 수량 변경 시 정가 자동 계산 (정가 = 단가 × 수량)
                  if (item.unitPrice && newQty) {
                    const unitPrice = parseAmount(item.unitPrice);
                    const qty = parseAmount(newQty);
                    if (unitPrice > 0 && qty > 0) {
                      const newOriginalPrice = autoFormatNumber(String(unitPrice * qty));
                      updateItem(item.id, 'originalPrice', newOriginalPrice);
                    }
                  }
                }}
                placeholder="1"
                className="text-sm bg-background h-9"
                min="0"
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <Input
                value={item.unitPrice || ''}
                onChange={(e) => {
                  handleNumberInput(e.target.value, (v) => {
                    updateItem(item.id, 'unitPrice', v);
                    // 단가 입력 시 정가 자동 계산 (정가 = 단가 × 수량)
                    if (v && item.quantity) {
                      const unitPrice = parseAmount(v);
                      const qty = parseAmount(item.quantity);
                      if (unitPrice > 0 && qty > 0) {
                        const newOriginalPrice = autoFormatNumber(String(unitPrice * qty));
                        updateItem(item.id, 'originalPrice', newOriginalPrice);
                      }
                    }
                  });
                }}
                placeholder="단가 (선택)"
                className="text-sm bg-background h-9 amount"
              />
              <Input
                value={item.originalPrice}
                onChange={(e) => {
                  handleNumberInput(e.target.value, (v) => {
                    // 정가 변경 시 할인가 자동 재계산
                    if (item.discountAmount) {
                      const orig = parseAmount(v);
                      const discAmt = parseAmount(item.discountAmount);
                      let discPrice = '';
                      if (orig > 0 && discAmt > 0) {
                        const result = orig - discAmt;
                        discPrice = result >= 0 ? autoFormatNumber(String(result)) : '';
                      }
                      setCurrentDoc((prev) => ({
                        ...prev,
                        items: prev.items.map((it) =>
                          it.id === item.id
                            ? { ...it, originalPrice: v, discountPrice: discPrice }
                            : it
                        ),
                      }));
                    } else {
                      updateItem(item.id, 'originalPrice', v);
                    }
                  });
                }}
                placeholder="900,000"
                className="text-sm bg-background h-9 amount"
              />
              <Input
                value={item.discountAmount || ''}
                onChange={(e) => {
                  handleNumberInput(e.target.value, (v) => {
                    // 할인금액 입력 시 할인가 자동 계산
                    setCurrentDoc((prev) => {
                      const currentItem = prev.items.find((it) => it.id === item.id);
                      if (!currentItem) return prev;
                      
                      const orig = parseAmount(currentItem.originalPrice);
                      const discAmt = parseAmount(v);
                      let discPrice = '';
                      if (orig > 0 && discAmt > 0) {
                        const result = orig - discAmt;
                        discPrice = result >= 0 ? autoFormatNumber(String(result)) : '';
                      }
                      
                      return {
                        ...prev,
                        items: prev.items.map((it) =>
                          it.id === item.id
                            ? { ...it, discountAmount: v, discountPrice: discPrice }
                            : it
                        ),
                      };
                    });
                  });
                }}
                placeholder="할인금액 (선택)"
                className="text-sm bg-background h-9 amount"
              />
              <Input
                value={item.discountPrice}
                onChange={(e) => {
                  handleNumberInput(e.target.value, (v) => {
                    // 할인가 입력 시 할인금액 자동 계산
                    const orig = parseAmount(item.originalPrice);
                    const discPrice = parseAmount(v);
                    let discAmt = '';
                    if (orig > 0) {
                      if (discPrice === 0) {
                        // 할인가가 0이면 할인금액 = 정가
                        discAmt = autoFormatNumber(String(orig));
                      } else if (discPrice > 0 && orig > discPrice) {
                        // 할인가가 정가보다 작으면 할인금액 계산
                        discAmt = autoFormatNumber(String(orig - discPrice));
                      }
                    }
                    setCurrentDoc((prev) => ({
                      ...prev,
                      items: prev.items.map((it) =>
                        it.id === item.id
                          ? { ...it, discountPrice: v, discountAmount: discAmt }
                          : it
                      ),
                    }));
                  });
                }}
                placeholder="할인가 (선택)"
                className="text-sm bg-background h-9 amount"
              />
              <button
                title="무료로 설정"
                onClick={() => {
                  const orig = parseAmount(item.originalPrice);
                  const isFree = parseAmount(item.discountAmount || '') === orig && orig > 0;
                  if (isFree) {
                    updateItem(item.id, 'discountAmount', '');
                    updateItem(item.id, 'discountPrice', '');
                  } else if (orig > 0) {
                    updateItem(item.id, 'discountAmount', item.originalPrice);
                    updateItem(item.id, 'discountPrice', '0');
                  }
                }}
                className={`w-8 h-8 flex items-center justify-center rounded transition-all opacity-0 group-hover:opacity-100 ${
                  parseAmount(item.discountAmount || '') === parseAmount(item.originalPrice) && parseAmount(item.originalPrice) > 0
                    ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 opacity-100'
                    : 'text-muted-foreground hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                }`}
              >
                <Gift className="w-3.5 h-3.5" />
              </button>
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
              <span className="text-muted-foreground">정가 합계</span>
              <span className="line-through text-muted-foreground amount">{totalOriginal.toLocaleString('ko-KR')}원</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-muted-foreground font-semibold">총 할인 ({discountPercent}%)</span>
              <span className="text-muted-foreground font-semibold amount">-{totalDiscount.toLocaleString('ko-KR')}원</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1 pt-1 border-t border-muted-foreground/20">
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

        <div className="space-y-4 mt-4">
          {isProposal ? (
            <>
              <div className="p-3 bg-muted rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-1">총합</p>
                <p className="text-lg font-bold text-foreground">{(showDiscount ? totalFinal : totalOriginal).toLocaleString('ko-KR')}원</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">최소 범위 (-10%)</label>
                  <Input
                    type="number"
                    value={currentDoc.totalMin}
                    onChange={(e) => updateField('totalMin', Number(e.target.value))}
                    placeholder="2000000"
                    className="bg-background amount"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">최대 범위 (+10%)</label>
                  <Input
                    type="number"
                    value={currentDoc.totalMax}
                    onChange={(e) => updateField('totalMax', Number(e.target.value))}
                    placeholder="2250000"
                    className="bg-background amount"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">최종 확정 금액 (원)</label>
              <Input
                type="text"
                value={currentDoc.totalMin ? currentDoc.totalMin.toLocaleString('ko-KR') : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  const val = raw ? Number(raw) : 0;
                  updateField('totalMin', val);
                  updateField('totalMax', val);
                  if (detectedVariables.includes('총금액')) {
                    handleVariableChange('총금액', val ? `${val.toLocaleString('ko-KR')}원` : '');
                    const { deposit, balance } = calculateAmounts(val, 50);
                    if (detectedVariables.includes('계약금')) handleVariableChange('계약금', deposit);
                    if (detectedVariables.includes('잔금')) handleVariableChange('잔금', balance);
                  }
                }}
                placeholder="2,125,000"
                className="bg-background amount text-right"
              />
            </div>
          )}
        </div>
      </div>

      {/* Notes Section with Mode Toggle */}
      <div className="bg-card rounded-lg border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground section-title">참고 사항</h3>
          <div className="flex items-center gap-2">
            <NoteTemplateActions
              currentNotes={currentDoc.notes}
              currentMode={currentDoc.notesMode}
              currentFreeformNotes={currentDoc.freeformNotes}
              onApplyTemplate={handleApplyTemplate}
            />
            {currentDoc.notesMode === 'list' && (
              <Button variant="outline" size="sm" onClick={addNote} className="text-xs gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                추가
              </Button>
            )}
          </div>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-4">
          <button
            onClick={() => handleNotesMode('list')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              currentDoc.notesMode === 'list'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            항목별 (리스트)
          </button>
          <button
            onClick={() => handleNotesMode('freeform')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              currentDoc.notesMode === 'freeform'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            자유형식 (계약서)
          </button>
        </div>

        {/* List Mode */}
        {currentDoc.notesMode === 'list' && (
          <>
            <p className="text-[11px] text-muted-foreground mb-3">
              드래그하여 순서를 변경할 수 있습니다. 계약 조항, 작업 범위, 결제 조건 등을 자유롭게 입력하세요.
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={noteIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
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
          </>
        )}

        {/* Freeform Mode */}
        {currentDoc.notesMode === 'freeform' && (
          <>
            <p className="text-[11px] text-muted-foreground mb-3">
              계약서 조항처럼 자유롭게 작성하세요. <strong>**굵은 글씨**</strong> 표기를 사용하면 PDF에서 굵게 표시됩니다.
            </p>
            <textarea
              value={currentDoc.freeformNotes || ''}
              onChange={(e) => handleFreeformNotesChange(e.target.value)}
              rows={16}
              className="w-full text-sm bg-background border border-input rounded-md px-4 py-3 resize-y min-h-[200px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 leading-relaxed"
              placeholder={`제 1조 (계약의 성립 및 효력 발생)\n\n1. 계약자는 계약서 내용을 확인하고 **계약금(총 제작비의 50%)**을 입금함으로써 본 계약 및 서비스 약관에 동의한 것으로 간주합니다.\n2. 계약금이 입금된 시점부터 본 계약의 효력이 발생합니다.\n\n제2조 (제작 및 진행 절차)\n\n1. 계약금 입금 후 홈페이지 제작을 착수합니다.`}
            />
            <p className="text-[10px] text-muted-foreground mt-2">
              팁: 조항 제목(예: 제1조, 제2조)은 자동으로 굵게 표시됩니다. 추가로 <code className="bg-muted px-1 rounded">**텍스트**</code>로 감싸면 해당 부분도 굵게 표시됩니다.
              {' '}<code className="bg-muted px-1 rounded">{`{{변수명}}`}</code>을 사용하면 문서마다 다른 값으로 치환할 수 있습니다.
            </p>

            {/* 변수 입력 UI */}
            {detectedVariables.length > 0 && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Variable className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-200">변수 입력</h4>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-full">
                    {detectedVariables.length}개 감지됨
                  </span>
                </div>
                <p className="text-[10px] text-amber-700 dark:text-amber-300 mb-3">
                  아래 변수에 값을 입력하면 미리보기와 PDF에서 자동으로 치환됩니다.
                </p>
                <VariableInputGrid
                  detectedVariables={detectedVariables}
                  templateVariables={currentDoc.templateVariables || {}}
                  onVariableChange={handleVariableChange}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSaving ? '저장 중...' : '저장하기'}
        </Button>
      </div>

      <ServiceItemPicker
        isOpen={servicePickerOpen}
        onClose={() => setServicePickerOpen(false)}
        onSelect={handleAddServiceItem}
      />
    </div>
  );
}
