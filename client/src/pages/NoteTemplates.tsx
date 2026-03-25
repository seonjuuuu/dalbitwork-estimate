import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BookmarkPlus,
  Edit,
  Trash2,
  Plus,
  Save,
  X,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronRight,
  List,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

type NotesMode = 'list' | 'freeform';

interface TemplateFormData {
  name: string;
  mode: NotesMode;
  notes: string[];
  freeformNotes: string;
}

const emptyForm: TemplateFormData = { name: '', mode: 'list', notes: [''], freeformNotes: '' };

function NoteEditor({
  notes,
  onChange,
}: {
  notes: string[];
  onChange: (notes: string[]) => void;
}) {
  const addNote = () => onChange([...notes, '']);
  const removeNote = (index: number) => onChange(notes.filter((_, i) => i !== index));
  const updateNote = (index: number, value: string) =>
    onChange(notes.map((n, i) => (i === index ? value : n)));

  return (
    <div className="space-y-2">
      {notes.map((note, idx) => (
        <div key={idx} className="flex gap-2 group">
          <span className="text-xs text-muted-foreground w-5 flex-shrink-0 pt-2.5">{idx + 1}.</span>
          <textarea
            value={note}
            onChange={(e) => updateNote(idx, e.target.value)}
            rows={Math.max(1, Math.ceil(note.length / 60))}
            className="flex-1 text-sm bg-background border border-input rounded-md px-3 py-2 resize-y min-h-[36px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            placeholder="참고 사항을 입력하세요..."
          />
          <button
            onClick={() => removeNote(idx)}
            className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-0.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addNote} className="text-xs gap-1.5 mt-2">
        <Plus className="w-3.5 h-3.5" />
        항목 추가
      </Button>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: NotesMode; onChange: (m: NotesMode) => void }) {
  return (
    <div className="flex gap-1 p-0.5 bg-muted rounded-lg w-fit">
      <button
        onClick={() => onChange('list')}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
          mode === 'list'
            ? 'bg-background text-foreground shadow-sm font-medium'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <List className="w-3.5 h-3.5" />
        리스트
      </button>
      <button
        onClick={() => onChange('freeform')}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
          mode === 'freeform'
            ? 'bg-background text-foreground shadow-sm font-medium'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <FileText className="w-3.5 h-3.5" />
        자유형식
      </button>
    </div>
  );
}

function TemplateEditor({ formData, setFormData }: {
  formData: TemplateFormData;
  setFormData: React.Dispatch<React.SetStateAction<TemplateFormData>>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">템플릿 이름</label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="예: 기본 계약 조항, 아임웹 제작 약관 등"
          className="bg-background"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">형식</label>
        <ModeToggle
          mode={formData.mode}
          onChange={(mode) => setFormData((prev) => ({ ...prev, mode }))}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">참고사항 내용</label>
        {formData.mode === 'list' ? (
          <NoteEditor
            notes={formData.notes}
            onChange={(notes) => setFormData((prev) => ({ ...prev, notes }))}
          />
        ) : (
          <div className="space-y-2">
            <textarea
              value={formData.freeformNotes}
              onChange={(e) => setFormData((prev) => ({ ...prev, freeformNotes: e.target.value }))}
              rows={12}
              className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 resize-y min-h-[200px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 font-mono leading-relaxed"
              placeholder={"제1조 (계약의 성립 및 효력 발생)\n\n1. 계약자는 계약서 내용을 확인하고...\n2. 계약금이 입금된 시점부터...\n\n※ **굵은 글씨**는 별표 두 개로 감싸주세요."}
            />
            <p className="text-xs text-muted-foreground">
              제N조 형식의 조항 제목은 자동으로 굵게 표시됩니다. 줄바꿈은 그대로 반영됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NoteTemplates() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<TemplateFormData>(emptyForm);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const templatesQuery = trpc.noteTemplates.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.noteTemplates.create.useMutation({
    onSuccess: () => {
      utils.noteTemplates.list.invalidate();
      setIsCreating(false);
      setFormData(emptyForm);
      toast.success('템플릿이 저장되었습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const updateMutation = trpc.noteTemplates.update.useMutation({
    onSuccess: () => {
      utils.noteTemplates.list.invalidate();
      setEditingId(null);
      toast.success('템플릿이 수정되었습니다.');
    },
    onError: () => toast.error('수정에 실패했습니다.'),
  });

  const deleteMutation = trpc.noteTemplates.delete.useMutation({
    onSuccess: () => {
      utils.noteTemplates.list.invalidate();
      toast.success('템플릿이 삭제되었습니다.');
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  });

  const templates = templatesQuery.data || [];

  const validateAndGetPayload = () => {
    if (!formData.name.trim()) {
      toast.error('템플릿 이름을 입력해주세요.');
      return null;
    }
    if (formData.mode === 'list') {
      const filteredNotes = formData.notes.filter((n) => n.trim() !== '');
      if (filteredNotes.length === 0) {
        toast.error('최소 하나의 참고사항을 입력해주세요.');
        return null;
      }
      return {
        name: formData.name.trim(),
        notes: filteredNotes,
        mode: 'list' as const,
        freeformNotes: '',
      };
    } else {
      if (!formData.freeformNotes.trim()) {
        toast.error('참고사항 내용을 입력해주세요.');
        return null;
      }
      return {
        name: formData.name.trim(),
        notes: [],
        mode: 'freeform' as const,
        freeformNotes: formData.freeformNotes,
      };
    }
  };

  const handleCreate = () => {
    const payload = validateAndGetPayload();
    if (!payload) return;
    createMutation.mutate(payload);
  };

  const handleUpdate = () => {
    if (editingId === null) return;
    const payload = validateAndGetPayload();
    if (!payload) return;
    updateMutation.mutate({ id: editingId, data: payload });
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('이 템플릿을 삭제하시겠습니까?')) return;
    deleteMutation.mutate({ id });
  };

  const startEdit = (tmpl: any) => {
    const mode: NotesMode = tmpl.mode === 'freeform' ? 'freeform' : 'list';
    setEditingId(tmpl.id);
    setIsCreating(false);
    setFormData({
      name: tmpl.name,
      mode,
      notes: mode === 'list' ? [...(tmpl.notes || [''])] : [''],
      freeformNotes: mode === 'freeform' ? (tmpl.freeformNotes || '') : '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormData(emptyForm);
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getTemplateDescription = (tmpl: any) => {
    const mode = tmpl.mode === 'freeform' ? 'freeform' : 'list';
    if (mode === 'freeform') {
      const lineCount = (tmpl.freeformNotes || '').split('\n').filter((l: string) => l.trim()).length;
      return `자유형식 · ${lineCount}줄`;
    }
    return `리스트 · ${(tmpl.notes || []).length}개 항목`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-foreground">참고사항 템플릿</h1>
          <span className="text-sm text-muted-foreground">({templates.length}건)</span>
        </div>
        {!isCreating && editingId === null && (
          <Button
            onClick={() => {
              setIsCreating(true);
              setFormData(emptyForm);
            }}
            className="gap-1.5"
            size="sm"
          >
            <BookmarkPlus className="w-4 h-4" />
            새 템플릿
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        자주 사용하는 참고사항(계약 조항, 서비스 약관 등)을 템플릿으로 저장하면 견적서/제안서 작성 시 빠르게 불러올 수 있습니다.
      </p>

      {/* Create Form */}
      {isCreating && (
        <div className="bg-card border-2 border-primary/30 rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BookmarkPlus className="w-4 h-4 text-primary" />
            새 템플릿 만들기
          </h3>
          <TemplateEditor formData={formData} setFormData={setFormData} />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={cancelEdit} className="gap-1.5">
              <X className="w-3.5 h-3.5" />
              취소
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="gap-1.5"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              저장
            </Button>
          </div>
        </div>
      )}

      {/* Template List */}
      {templatesQuery.isLoading ? (
        <div className="text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">불러오는 중...</p>
        </div>
      ) : templates.length === 0 && !isCreating ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">저장된 템플릿이 없습니다.</p>
          <p className="text-xs mt-1">새 템플릿을 만들어 자주 쓰는 참고사항을 저장하세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tmpl) => {
            const isEditing = editingId === tmpl.id;
            const isExpanded = expandedIds.has(tmpl.id);
            const tmplMode = (tmpl as any).mode === 'freeform' ? 'freeform' : 'list';

            if (isEditing) {
              return (
                <div key={tmpl.id} className="bg-card border-2 border-primary/30 rounded-lg p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Edit className="w-4 h-4 text-primary" />
                    템플릿 수정
                  </h3>
                  <TemplateEditor formData={formData} setFormData={setFormData} />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" size="sm" onClick={cancelEdit} className="gap-1.5">
                      <X className="w-3.5 h-3.5" />
                      취소
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUpdate}
                      disabled={updateMutation.isPending}
                      className="gap-1.5"
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      저장
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={tmpl.id}
                className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-colors"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4">
                  <button
                    onClick={() => toggleExpand(tmpl.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {tmplMode === 'freeform' ? (
                        <FileText className="w-4 h-4 text-primary" />
                      ) : (
                        <List className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{tmpl.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getTemplateDescription(tmpl)}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground ml-2" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground ml-2" />
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(tmpl)}
                      className="text-xs gap-1 h-8"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      수정
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(tmpl.id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs gap-1 h-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-border">
                    <div className="mt-3">
                      {tmplMode === 'list' ? (
                        <div className="space-y-1.5">
                          {(tmpl.notes || []).map((note: string, idx: number) => (
                            <div key={idx} className="flex gap-2 text-sm">
                              <span className="text-xs text-muted-foreground w-5 flex-shrink-0 pt-0.5">
                                {idx + 1}.
                              </span>
                              <p className="text-foreground/80 whitespace-pre-wrap">{note}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                          {renderFreeformPreview((tmpl as any).freeformNotes || '')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Render freeform text with bold article headings for preview */
function renderFreeformPreview(text: string) {
  if (!text) return null;
  const lines = text.split('\n');
  const articlePattern = /^\s*제\s*\d+\s*조/;

  return lines.map((line, i) => {
    if (line.trim() === '') {
      return <div key={i} className="h-2" />;
    }
    if (articlePattern.test(line)) {
      return (
        <div key={i} className="font-bold text-foreground mt-3 mb-1">
          {line}
        </div>
      );
    }
    // Handle **bold** markers
    if (line.includes('**')) {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <div key={i}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j}>{part.slice(2, -2)}</strong>;
            }
            return <span key={j}>{part}</span>;
          })}
        </div>
      );
    }
    return <div key={i}>{line}</div>;
  });
}
