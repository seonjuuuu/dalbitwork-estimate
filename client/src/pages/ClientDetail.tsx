import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useEstimate } from '@/contexts/EstimateContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ko } from 'date-fns/locale';
import {
  ArrowLeft, Plus, Trash2, Save, X, Loader2,
  Phone, Mail, User, CalendarDays, CircleDollarSign,
  MessageSquare, ChevronDown, ChevronUp, Edit, LinkIcon, FileText, ExternalLink, Hash,
  Upload, Download, Eye, Copy, FileDown, CreditCard, CheckCircle2, Image as ImageIcon, Sparkles, ListTree,
  Clock, ListTodo, Check, ClipboardList, ClipboardCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import DepositConfirmDialog from '@/components/DepositConfirmDialog';
import FinalPaymentConfirmDialog from '@/components/FinalPaymentConfirmDialog';
import NotesEditPdfDialog from '@/components/NotesEditPdfDialog';
import AIEstimateDraftDialog from '@/components/AIEstimateDraftDialog';
import AISiteStructureDialog from '@/components/AISiteStructureDialog';
import ClientRequestChecklistDialog from '@/components/ClientRequestChecklistDialog';
import SiteStructureEntryCard from '@/components/SiteStructureEntryCard';
import Linkify from '@/components/Linkify';
import { formatPhone } from '@/lib/utils';
import type { DocumentData } from '@/lib/types';

interface ConsultationForm {
  date: string;
  content: string;
  nextAction: string;
}

const today = new Date().toISOString().split('T')[0].replace(/-/g, '.');
const emptyForm: ConsultationForm = { date: today, content: '', nextAction: '' };

const STATUSES = ['상담', '제안서', '계약', '완료'] as const;
type Status = typeof STATUSES[number];

const STATUS_STYLE: Record<Status, string> = {
  '상담': 'bg-muted text-muted-foreground hover:bg-muted/80',
  '제안서': 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-400',
  '계약': 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-400',
  '완료': 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400',
};

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

// 모든 질문폼에 기본으로 들어가는 질문 (홈페이지 제작 시 항상 필요한 정보) — 회사별로 필요하면 직접 더 추가/수정
// 앞에 "*"를 붙이면 필수 질문 (질문폼 생성 다이얼로그의 텍스트 파싱 규칙과 동일)
const DEFAULT_INTAKE_QUESTIONS = [
  '* (지역/업체명/대표자)를 적어주세요 (예: 서울 / 달빛워크 / 김철수)',
  '* 로고 준비가 되어있으신가요? (PSD·PNG·JPG 파일이 있다면 함께 전달 부탁드려요. 없다면 없다고 적어주세요)',
  '* 메인페이지에서 강조하고 싶은 제품 및 원하는 메인 문구를 적어주세요',
  '* 회사의 장점을 마음껏 적어주세요 (제일 중요! 많이 적어주실수록 좋아요)',
  '회사의 단점을 적어주세요',
  '회사 소개 문구를 적어주세요',
  '지역에 있는 경쟁업체 이름을 적어주세요 (그 업체를 분석해 우위에 서도록 하겠습니다)',
  '회사 총 면적을 적어주세요',
  '(방문이 가능하다면) 대중교통으로 오는 방법을 안내해주세요',
  '이메일을 적어주세요',
  '업체 주소를 적어주세요',
  '사업자등록번호를 적어주세요',
  '전화번호를 적어주세요',
  '계좌번호를 적어주세요',
  'SNS 주소를 적어주세요 (블로그, 인스타그램 등)',
  '벤치마킹하고 싶은 사이트를 적어주세요',
  '추가 요청사항을 적어주세요',
  '회사 운영시간을 적어주세요',
  '홈페이지에 꼭 들어갔으면 하는 기능이 있다면 적어주세요',
];

/** "* 질문내용" 줄은 필수로 처리하고 앞의 "*"는 제거 */
function parseIntakeQuestionLines(text: string): { text: string; required: boolean }[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith('*')) {
        return { text: line.slice(1).trim(), required: true };
      }
      return { text: line, required: false };
    });
}

type IntakeFieldType = 'text' | 'textarea' | 'select';
const FIELD_TYPE_LABEL: Record<IntakeFieldType, string> = {
  text: '단답형',
  textarea: '장문형',
  select: '객관식',
};
interface EditableIntakeField {
  text: string;
  required: boolean;
  type: IntakeFieldType;
  options: string[];
  suggested?: boolean;
  reason?: string;
}

const TODO_PRIORITY_LABEL: Record<string, { label: string; cls: string }> = {
  high: { label: '높음', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  medium: { label: '보통', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  low: { label: '낮음', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400' },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ClientAttachments({ clientId }: { clientId: number }) {
  const { data: files = [], refetch, isLoading: isLoadingFiles } = trpc.pdfFiles.listByClient.useQuery({ clientId });
  const uploadMutation = trpc.pdfFiles.upload.useMutation();
  const deleteMutation = trpc.pdfFiles.delete.useMutation();
  const getPdfMutation = trpc.pdfFiles.get.useMutation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [previewMimeType, setPreviewMimeType] = useState('');

  useEffect(() => {
    return () => { if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl); };
  }, [previewBlobUrl]);

  const closePreview = () => {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    setPreviewBlobUrl(null);
    setPreviewName('');
    setPreviewMimeType('');
  };

  const handleFiles = async (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    const file = selected[0];
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      toast.error('PDF 또는 이미지 파일만 업로드 가능합니다.');
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      toast.error('파일 크기는 10MB 이하만 가능합니다.');
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await uploadMutation.mutateAsync({ name: file.name, fileSize: file.size, data: base64, clientId, mimeType: file.type });
      await refetch();
      toast.success('첨부파일이 업로드되었습니다.');
    } catch {
      toast.error('업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePreview = async (id: number, name: string, mimeType: string) => {
    setBusyId(id);
    try {
      const row = await getPdfMutation.mutateAsync({ id });
      if (!row) { toast.error('파일을 찾을 수 없습니다.'); return; }
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
      const blob = new Blob([Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0))], { type: mimeType });
      setPreviewBlobUrl(URL.createObjectURL(blob));
      setPreviewName(name);
      setPreviewMimeType(mimeType);
    } catch {
      toast.error('미리보기에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (id: number, name: string, mimeType: string) => {
    setBusyId(id);
    try {
      const row = await getPdfMutation.mutateAsync({ id });
      if (!row) { toast.error('파일을 찾을 수 없습니다.'); return; }
      const blob = new Blob([Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0))], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('다운로드에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}"을 삭제하시겠습니까?`)) return;
    setBusyId(id);
    try {
      await deleteMutation.mutateAsync({ id });
      await refetch();
      toast.success('삭제됐습니다.');
    } catch {
      toast.error('삭제에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          첨부파일
          {files.length > 0 && <span className="text-xs text-muted-foreground font-normal">({files.length}건)</span>}
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          파일 업로드
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      <p className="text-[11px] text-muted-foreground/60 -mt-1.5 mb-3">PDF 또는 이미지(현금영수증 캡처 등) · 최대 10MB</p>

      {isLoadingFiles ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 italic">첨부된 파일이 없습니다.</p>
      ) : (
        <div className="space-y-1.5">
          {files.map((file) => {
            const isImage = file.mimeType?.startsWith('image/');
            return (
              <div key={file.id} className="flex items-center gap-2 px-3 py-2 bg-muted/20 border border-border rounded-lg">
                {isImage ? (
                  <ImageIcon className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                )}
                <span className="text-sm text-foreground truncate flex-1">{file.name}</span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatBytes(file.fileSize)}</span>
                <button
                  onClick={() => handlePreview(file.id, file.name, file.mimeType || 'application/pdf')}
                  disabled={busyId === file.id}
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  {busyId === file.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleDownload(file.id, file.name, file.mimeType || 'application/pdf')}
                  disabled={busyId === file.id}
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(file.id, file.name)}
                  disabled={busyId === file.id}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewBlobUrl} onOpenChange={(open) => { if (!open) closePreview(); }}>
        <DialogContent className="max-w-4xl w-[90vw] h-[90vh] flex flex-col p-0 gap-0">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0 pr-12">
            <p className="text-sm font-medium text-foreground truncate flex-1">{previewName}</p>
          </div>
          {previewBlobUrl && (
            previewMimeType.startsWith('image/') ? (
              <div className="flex-1 w-full overflow-auto flex items-center justify-center bg-muted/20">
                <img src={previewBlobUrl} alt={previewName} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <iframe src={previewBlobUrl} className="flex-1 w-full border-0" title={previewName} />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ClientDetail({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const clientId = parseInt(id);

  const { data: client, refetch: refetchClient } = trpc.clients.get.useQuery({ id: clientId });
  const { data: consultations = [], refetch, isLoading: isLoadingConsultations } = trpc.consultations.list.useQuery({ clientId });
  const { data: matchedEstimates = [], isLoading: isLoadingMatchedEstimates } = trpc.clients.getMatchedEstimates.useQuery(
    { clientName: client?.name ?? '' },
    { enabled: !!client?.name }
  );
  const { data: matchedProposals = [], isLoading: isLoadingMatchedProposals } = trpc.clients.getMatchedProposals.useQuery(
    { clientName: client?.name ?? '' },
    { enabled: !!client?.name }
  );
  const { data: linkedEvents = [], refetch: refetchLinkedEvents } = trpc.calendar.listCustomEventsByClient.useQuery({ clientId });
  const deleteLinkedEventMutation = trpc.calendar.deleteCustomEvent.useMutation();
  const { data: linkedTodos = [], refetch: refetchLinkedTodos } = trpc.todos.listByClient.useQuery({ clientId });
  const updateTodoMutation = trpc.todos.update.useMutation();
  const deleteTodoMutation = trpc.todos.delete.useMutation();
  const { data: intakeForms = [], refetch: refetchIntakeForms } = trpc.forms.listByClient.useQuery({ clientId });
  const createFormMutation = trpc.forms.create.useMutation();
  const deleteFormMutation = trpc.forms.deleteForm.useMutation();
  const classifyFieldsMutation = trpc.forms.classifyFields.useMutation();
  const suggestQuestionsMutation = trpc.forms.suggestQuestions.useMutation();
  const updateClientMutation = trpc.clients.update.useMutation();
  const updateDocumentMutation = trpc.documents.update.useMutation();
  const createMutation = trpc.consultations.create.useMutation();
  const updateMutation = trpc.consultations.update.useMutation();
  const deleteMutation = trpc.consultations.delete.useMutation();

  // 문서 관리(복사/PDF/계약금·잔금 확정/삭제)
  const { proposals, estimates, deleteDocument } = useEstimate();
  const utils = trpc.useUtils();
  const copyDocMutation = trpc.documents.copyDocument.useMutation();
  const duplicateAsEstimateMutation = trpc.documents.duplicateAsEstimate.useMutation();
  const { data: depositedIds = [] } = trpc.documents.getDepositedDocumentIds.useQuery();
  const { data: finalPaidIds = [] } = trpc.documents.getFinalPaidDocumentIds.useQuery();
  const depositedSet = new Set(depositedIds);
  const finalPaidSet = new Set(finalPaidIds);
  const [notesDialogDoc, setNotesDialogDoc] = useState<DocumentData | null>(null);
  const [copyingDocId, setCopyingDocId] = useState<string | null>(null);
  const [duplicatingDocId, setDuplicatingDocId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [finalDialogOpen, setFinalDialogOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedDocData, setSelectedDocData] = useState<{ totalMax: number; clientName: string; depositRatio: number } | null>(null);
  const [finalDepositAmount, setFinalDepositAmount] = useState(0);
  const [openingFinalId, setOpeningFinalId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ConsultationForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingMemoId, setEditingMemoId] = useState<number | null>(null);
  const [memoDraft, setMemoDraft] = useState('');
  const [savingMemoId, setSavingMemoId] = useState<number | null>(null);
  const [finalPaymentDate, setFinalPaymentDate] = useState('');
  const [finalPaymentAmount, setFinalPaymentAmount] = useState('');
  const [aiDraftDialogOpen, setAiDraftDialogOpen] = useState(false);
  const [aiStructureDialogOpen, setAiStructureDialogOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formFields, setFormFields] = useState<EditableIntakeField[]>([]);
  const [isCreatingForm, setIsCreatingForm] = useState(false);
  const [isClassifyingFields, setIsClassifyingFields] = useState(false);
  const [isSuggestingQuestions, setIsSuggestingQuestions] = useState(false);
  const [requestChecklistDialogOpen, setRequestChecklistDialogOpen] = useState(false);
  const [viewingAnswersForm, setViewingAnswersForm] = useState<(typeof intakeForms)[number] | null>(null);
  const [deletingFormId, setDeletingFormId] = useState<number | null>(null);
  const [showFormPreview, setShowFormPreview] = useState(false);
  const [isSavingFinal, setIsSavingFinal] = useState(false);
  const [editingFinal, setEditingFinal] = useState(false);

  useEffect(() => {
    if (client) {
      setFinalPaymentDate(client.finalPaymentDate ?? '');
      setFinalPaymentAmount(client.finalPaymentAmount ? client.finalPaymentAmount.toLocaleString('ko-KR') : '');
      setEditingFinal(!client.finalPaymentDate);
      setInfoForm({
        name: client.name ?? '',
        contactName: client.contactName ?? '',
        contactPhone: client.contactPhone ?? '',
        contactEmail: client.contactEmail ?? '',
        noContact: client.noContact ?? false,
        businessNumber: client.businessNumber ?? '',
        contractDate: client.contractDate ?? '',
        contractAmount: client.contractAmount ? client.contractAmount.toLocaleString('ko-KR') : '',
        memo: client.memo ?? '',
      });
    }
  }, [client?.id]);
  const [calendarMonth, setCalendarMonth] = useState<Date | undefined>(undefined);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [syncingEstimateId, setSyncingEstimateId] = useState<number | null>(null);
  const [syncedEstimateId, setSyncedEstimateId] = useState<number | null>(null);
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    name: '', contactName: '', contactPhone: '', contactEmail: '', noContact: false, businessNumber: '',
    contractDate: '', contractAmount: '', memo: '',
  });
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  const [editingWorkSchedule, setEditingWorkSchedule] = useState(false);
  const [isSavingWorkSchedule, setIsSavingWorkSchedule] = useState(false);
  const [workScheduleForm, setWorkScheduleForm] = useState({
    workStartDate: '', pcDraftDate: '', mobileDraftDate: '', finalDeliveryDate: '',
  });

  useEffect(() => {
    if (client) {
      setWorkScheduleForm({
        workStartDate: client.workStartDate ?? '',
        pcDraftDate: client.pcDraftDate ?? '',
        mobileDraftDate: client.mobileDraftDate ?? '',
        finalDeliveryDate: client.finalDeliveryDate ?? '',
      });
    }
  }, [client?.id]);

  const handleWorkScheduleDateInput = (field: keyof typeof workScheduleForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 4) + '.' + digits.slice(4);
    if (digits.length > 6) formatted = digits.slice(0, 4) + '.' + digits.slice(4, 6) + '.' + digits.slice(6);
    setWorkScheduleForm((f) => ({ ...f, [field]: formatted }));
  };

  const handleSaveWorkSchedule = async () => {
    setIsSavingWorkSchedule(true);
    try {
      await updateClientMutation.mutateAsync({ id: clientId, ...workScheduleForm });
      await refetchClient();
      setEditingWorkSchedule(false);
      toast.success('작업 일정이 저장되었습니다.');
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSavingWorkSchedule(false);
    }
  };

  const handleDeleteLinkedEvent = async (eventId: number) => {
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return;
    try {
      await deleteLinkedEventMutation.mutateAsync({ id: eventId });
      await refetchLinkedEvents();
      toast.success('일정을 삭제했습니다.');
    } catch {
      toast.error('일정 삭제에 실패했습니다.');
    }
  };

  const handleToggleLinkedTodo = async (id: number, completed: boolean) => {
    try {
      await updateTodoMutation.mutateAsync({ id, completed: !completed });
      await refetchLinkedTodos();
    } catch {
      toast.error('변경에 실패했습니다.');
    }
  };

  const handleDeleteLinkedTodo = async (id: number) => {
    try {
      await deleteTodoMutation.mutateAsync({ id });
      await refetchLinkedTodos();
      toast.success('할 일을 삭제했습니다.');
    } catch {
      toast.error('삭제에 실패했습니다.');
    }
  };

  const handleOpenFormDialog = async () => {
    setShowFormPreview(false);
    setFormDialogOpen(true);
    setIsClassifyingFields(true);
    const base = parseIntakeQuestionLines(DEFAULT_INTAKE_QUESTIONS.join('\n'));
    try {
      const classified = await classifyFieldsMutation.mutateAsync({ questions: base });
      setFormFields(classified.map((f) => ({ text: f.text, required: f.required, type: f.type, options: f.options || [] })));
    } catch {
      toast.error('AI 분류에 실패해서 기본 형태로 불러왔어요.');
      setFormFields(base.map((q) => ({ ...q, type: 'textarea' as const, options: [] })));
    } finally {
      setIsClassifyingFields(false);
    }
  };

  const handleSuggestQuestions = async () => {
    setIsSuggestingQuestions(true);
    try {
      const suggestions = await suggestQuestionsMutation.mutateAsync({
        clientId,
        existingQuestions: formFields.map((f) => f.text).filter(Boolean),
      });
      if (suggestions.length === 0) {
        toast.info('상담 이력·메모를 참고했지만 추가로 제안할 질문을 찾지 못했어요.');
        return;
      }
      setFormFields((prev) => [
        ...prev,
        ...suggestions.map((s) => ({
          text: s.text,
          required: s.required,
          type: s.type,
          options: s.options || [],
          suggested: true,
          reason: s.reason,
        })),
      ]);
      toast.success(`AI가 질문 ${suggestions.length}개를 추천했어요. 필요 없는 건 지워주세요.`);
    } catch {
      toast.error('추천에 실패했습니다.');
    } finally {
      setIsSuggestingQuestions(false);
    }
  };

  const updateFormField = (index: number, patch: Partial<EditableIntakeField>) => {
    setFormFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };
  const removeFormField = (index: number) => {
    setFormFields((prev) => prev.filter((_, i) => i !== index));
  };
  const addFormField = () => {
    setFormFields((prev) => [...prev, { text: '', required: false, type: 'text', options: [] }]);
  };
  const addFieldOption = (index: number) => {
    updateFormField(index, { options: [...formFields[index].options, ''] });
  };
  const updateFieldOption = (index: number, optIndex: number, value: string) => {
    const options = [...formFields[index].options];
    options[optIndex] = value;
    updateFormField(index, { options });
  };
  const removeFieldOption = (index: number, optIndex: number) => {
    updateFormField(index, { options: formFields[index].options.filter((_, i) => i !== optIndex) });
  };

  const handleCreateForm = async () => {
    const questions = formFields
      .map((f) => ({ ...f, text: f.text.trim() }))
      .filter((f) => f.text)
      .map((f) => ({
        text: f.text,
        required: f.required,
        type: f.type,
        options: f.type === 'select' ? f.options.map((o) => o.trim()).filter(Boolean) : undefined,
      }));
    if (questions.length === 0) {
      toast.error('질문을 하나 이상 입력해주세요.');
      return;
    }
    setIsCreatingForm(true);
    try {
      await createFormMutation.mutateAsync({ clientId, questions });
      await refetchIntakeForms();
      toast.success('질문폼 링크를 만들었어요.');
      setFormDialogOpen(false);
    } catch {
      toast.error('생성에 실패했습니다.');
    } finally {
      setIsCreatingForm(false);
    }
  };

  const handleDeleteIntakeForm = async (id: number) => {
    if (!window.confirm('이 질문폼을 삭제하시겠습니까?')) return;
    setDeletingFormId(id);
    try {
      await deleteFormMutation.mutateAsync({ id });
      await refetchIntakeForms();
      toast.success('삭제했습니다.');
    } catch {
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeletingFormId(null);
    }
  };

  const handleCopyFormLink = async (token: string) => {
    const url = `${window.location.origin}/f/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('링크를 복사했어요.');
    } catch {
      toast.error('복사에 실패했습니다. 직접 선택해서 복사해주세요.');
    }
  };

  useEffect(() => {
    if (client && (client as any).linkedEstimateId) {
      setSyncedEstimateId((client as any).linkedEstimateId);
    }
  }, [client]);

  const parseDateString = (str: string): Date | undefined => {
    const parts = str.split('.');
    if (parts.length === 3 && parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  };

  const handleStatusChange = async (newStatus: Status) => {
    setStatusPopoverOpen(false);
    try {
      await updateClientMutation.mutateAsync({ id: clientId, status: newStatus });
      await refetchClient();
      toast.success(`상태가 "${newStatus}"로 변경되었습니다.`);
    } catch {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  const handleSyncEstimate = async (est: typeof matchedEstimates[0]) => {
    setSyncingEstimateId(est.id);
    try {
      await updateClientMutation.mutateAsync({
        id: clientId,
        contractDate: est.date || '',
        contractAmount: est.totalMin || 0,
        linkedEstimateId: est.id,
      });
      await refetchClient();
      setSyncedEstimateId(est.id);
      toast.success('계약서 정보가 연동되었습니다.');
    } catch {
      toast.error('연동에 실패했습니다.');
    } finally {
      setSyncingEstimateId(null);
    }
  };

  const handleSaveFinalPayment = async () => {
    setIsSavingFinal(true);
    try {
      const amount = finalPaymentAmount ? Number(finalPaymentAmount.replace(/,/g, '')) : null;
      await updateClientMutation.mutateAsync({
        id: clientId,
        finalPaymentDate: finalPaymentDate || null,
        finalPaymentAmount: amount,
      });
      await refetchClient();
      setEditingFinal(false);
      toast.success('잔금 정보가 저장되었습니다.');
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSavingFinal(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!infoForm.name.trim()) { toast.error('고객사명을 입력해주세요.'); return; }
    setIsSavingInfo(true);
    try {
      await updateClientMutation.mutateAsync({
        id: clientId,
        name: infoForm.name.trim(),
        contactName: infoForm.contactName,
        contactPhone: infoForm.contactPhone,
        contactEmail: infoForm.contactEmail,
        noContact: infoForm.noContact,
        businessNumber: infoForm.businessNumber,
        contractDate: infoForm.contractDate,
        contractAmount: infoForm.contractAmount ? Number(infoForm.contractAmount.replace(/,/g, '')) : 0,
        memo: infoForm.memo,
      });
      await refetchClient();
      setEditingInfo(false);
      toast.success('기본 정보가 저장되었습니다.');
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSavingInfo(false);
    }
  };

  const handleSaveMemo = async (estId: number) => {
    setSavingMemoId(estId);
    try {
      await updateDocumentMutation.mutateAsync({ id: estId, data: { memo: memoDraft } });
      setEditingMemoId(null);
      toast.success('메모가 저장되었습니다.');
    } catch {
      toast.error('메모 저장에 실패했습니다.');
    } finally {
      setSavingMemoId(null);
    }
  };

  const handleCopyDoc = async (docId: number, type: 'proposal' | 'estimate') => {
    setCopyingDocId(String(docId));
    try {
      const copied = await copyDocMutation.mutateAsync({ id: docId });
      await utils.documents.list.invalidate();
      if (copied?.id) {
        navigate(type === 'proposal' ? `/proposals/${copied.id}` : `/estimates/${copied.id}`);
        toast.success('복사되었습니다. 제목과 고객 정보를 입력해 주세요.');
      }
    } catch {
      toast.error('복사에 실패했습니다.');
    } finally {
      setCopyingDocId(null);
    }
  };

  const handleDuplicateAsEstimate = async (docId: number) => {
    setDuplicatingDocId(String(docId));
    try {
      const estimate = await duplicateAsEstimateMutation.mutateAsync({ id: docId });
      await utils.documents.list.invalidate();
      if (estimate?.id) {
        navigate(`/estimates/${estimate.id}`);
        toast.success('견적서로 변환되었습니다.');
      }
    } catch {
      toast.error('변환에 실패했습니다.');
    } finally {
      setDuplicatingDocId(null);
    }
  };

  const handleDeleteDoc = async (docId: number, type: 'proposal' | 'estimate') => {
    const label = type === 'proposal' ? '제안서' : '견적서';
    if (!window.confirm(`이 ${label}를 삭제하시겠습니까?`)) return;
    setDeletingDocId(String(docId));
    try {
      await deleteDocument(String(docId), type);
      toast.success(`${label}가 삭제되었습니다.`);
    } catch {
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleOpenDepositDialog = (docId: number, totalMax: number, clientName: string, depositRatio: number) => {
    setSelectedDocId(docId);
    setSelectedDocData({ totalMax, clientName, depositRatio });
    setDepositDialogOpen(true);
  };

  const handleDepositSuccess = () => {
    utils.documents.list.invalidate();
    utils.documents.getDepositedDocumentIds.invalidate();
  };

  const handleFinalSuccess = () => {
    utils.documents.list.invalidate();
    utils.documents.getFinalPaidDocumentIds.invalidate();
  };

  const handleOpenFinalDialog = async (docId: number, totalMax: number, clientName: string, depositRatio: number) => {
    setOpeningFinalId(docId);
    try {
      const payments = await utils.documents.getPayments.fetch({ documentId: docId });
      const actualDeposit = payments
        .filter((p) => p.type === 'deposit')
        .reduce((sum, p) => sum + p.amount, 0);
      setSelectedDocId(docId);
      setSelectedDocData({ totalMax, clientName, depositRatio });
      setFinalDepositAmount(actualDeposit);
      setFinalDialogOpen(true);
    } catch {
      toast.error('결제 내역을 불러오지 못했습니다.');
    } finally {
      setOpeningFinalId(null);
    }
  };

  const handleNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const handleEdit = (c: typeof consultations[0]) => {
    setEditingId(c.id);
    setForm({ date: c.date, content: c.content, nextAction: c.nextAction });
    const d = parseDateString(c.date);
    if (d) setCalendarMonth(d);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.content.trim()) {
      toast.error('상담 내용을 입력해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId !== null) {
        await updateMutation.mutateAsync({ id: editingId, ...form });
        toast.success('수정되었습니다.');
      } else {
        await createMutation.mutateAsync({ clientId, ...form });
        toast.success('상담 이력이 추가되었습니다.');
      }
      await refetch();
      handleCancel();
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (consultId: number) => {
    if (!window.confirm('이 상담 이력을 삭제하시겠습니까?')) return;
    try {
      await deleteMutation.mutateAsync({ id: consultId });
      await refetch();
      toast.success('삭제되었습니다.');
    } catch {
      toast.error('삭제에 실패했습니다.');
    }
  };

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 4) + '.' + digits.slice(4);
    if (digits.length > 6) formatted = digits.slice(0, 4) + '.' + digits.slice(4, 6) + '.' + digits.slice(6);
    setForm((f) => ({ ...f, date: formatted }));
    const d = parseDateString(formatted);
    if (d) setCalendarMonth(d);
  };

  if (!client) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentStatus = (client.status ?? '상담') as Status;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/clients')}
          className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">{client.name}</h1>

            {/* 클릭해서 상태 변경 */}
            <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-colors cursor-pointer ${STATUS_STYLE[currentStatus]}`}
                >
                  {currentStatus}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1" align="start">
                <p className="text-[10px] text-muted-foreground px-2 py-1">상태 변경</p>
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors flex items-center gap-2 ${
                      s === currentStatus ? 'font-semibold bg-accent' : 'hover:bg-accent'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      s === '상담' ? 'bg-muted-foreground' :
                      s === '제안서' ? 'bg-blue-500' : 'bg-amber-500'
                    }`} />
                    {s}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* 고객 기본 정보 */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">기본 정보</h2>
          {!editingInfo ? (
            <Button size="sm" variant="outline" onClick={() => setEditingInfo(true)} className="h-7 text-xs gap-1">
              <Edit className="w-3 h-3" />수정
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => { setEditingInfo(false); }} className="h-7 text-xs gap-1">
                <X className="w-3 h-3" />취소
              </Button>
              <Button size="sm" onClick={handleSaveInfo} disabled={isSavingInfo} className="h-7 text-xs gap-1">
                {isSavingInfo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}저장
              </Button>
            </div>
          )}
        </div>

        {editingInfo ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">고객사명 *</label>
                <Input value={infoForm.name} onChange={e => setInfoForm(f => ({ ...f, name: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">사업자번호</label>
                <Input value={infoForm.businessNumber} onChange={e => setInfoForm(f => ({ ...f, businessNumber: e.target.value }))} className="text-sm" placeholder="000-00-00000" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">담당자</label>
                <Input value={infoForm.contactName} onChange={e => setInfoForm(f => ({ ...f, contactName: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-muted-foreground">연락처</label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={infoForm.noContact}
                      onCheckedChange={(checked) => {
                        const isChecked = checked === true;
                        setInfoForm(f => ({ ...f, noContact: isChecked, ...(isChecked && { contactPhone: '', contactEmail: '' }) }));
                      }}
                    />
                    연락처 없음
                  </label>
                </div>
                <Input value={infoForm.contactPhone} onChange={e => setInfoForm(f => ({ ...f, contactPhone: formatPhone(e.target.value) }))} className="text-sm" placeholder="010-0000-0000" disabled={infoForm.noContact} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">이메일 <span className="text-muted-foreground/70">(연락처 없을 때 대신 입력)</span></label>
                <Input type="email" value={infoForm.contactEmail} onChange={e => setInfoForm(f => ({ ...f, contactEmail: e.target.value }))} className="text-sm" placeholder="example@company.com" disabled={infoForm.noContact} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">계약일</label>
                <Input value={infoForm.contractDate} onChange={e => setInfoForm(f => ({ ...f, contractDate: e.target.value }))} className="text-sm" placeholder="2026.01.01" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">계약금액 (원)</label>
                <Input
                  value={infoForm.contractAmount}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setInfoForm(f => ({ ...f, contractAmount: raw ? Number(raw).toLocaleString('ko-KR') : '' }));
                  }}
                  className="text-sm text-right"
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">메모</label>
              <textarea
                value={infoForm.memo}
                onChange={e => setInfoForm(f => ({ ...f, memo: e.target.value }))}
                rows={3}
                className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="메모를 입력하세요"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {client.contactName && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{client.contactName}</span>
                </div>
              )}
              {client.contactPhone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{client.contactPhone}</span>
                </div>
              )}
              {client.contactEmail && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{client.contactEmail}</span>
                </div>
              )}
              {client.noContact && !client.contactPhone && !client.contactEmail && (
                <div className="flex items-center gap-2 text-muted-foreground/70">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>연락처 없음</span>
                </div>
              )}
              {client.contractDate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{client.contractDate}</span>
                </div>
              )}
              {client.contractAmount > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CircleDollarSign className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-semibold text-foreground">{client.contractAmount.toLocaleString('ko-KR')}원</span>
                </div>
              )}
              {client.businessNumber && (
                <div className="col-span-2 flex items-center gap-2 text-muted-foreground text-sm">
                  <Hash className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{client.businessNumber}</span>
                </div>
              )}
            </div>
            {client.memo && (
              <p className="mt-3 text-xs text-muted-foreground/80 border-t border-border pt-3 whitespace-pre-wrap"><Linkify text={client.memo} /></p>
            )}
          </>
        )}
      </div>

      {/* 작업 일정 */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">작업 일정</h2>
          {!editingWorkSchedule ? (
            <Button size="sm" variant="outline" onClick={() => setEditingWorkSchedule(true)} className="h-7 text-xs gap-1">
              <Edit className="w-3 h-3" />수정
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setEditingWorkSchedule(false)} className="h-7 text-xs gap-1">
                <X className="w-3 h-3" />취소
              </Button>
              <Button size="sm" onClick={handleSaveWorkSchedule} disabled={isSavingWorkSchedule} className="h-7 text-xs gap-1">
                {isSavingWorkSchedule ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}저장
              </Button>
            </div>
          )}
        </div>

        {editingWorkSchedule ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">작업 시작일</label>
              <Input value={workScheduleForm.workStartDate} onChange={handleWorkScheduleDateInput('workStartDate')} placeholder="2026.01.01" maxLength={10} className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">PC 시안일</label>
              <Input value={workScheduleForm.pcDraftDate} onChange={handleWorkScheduleDateInput('pcDraftDate')} placeholder="2026.01.01" maxLength={10} className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">모바일 작업일</label>
              <Input value={workScheduleForm.mobileDraftDate} onChange={handleWorkScheduleDateInput('mobileDraftDate')} placeholder="2026.01.01" maxLength={10} className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">완성 전달일</label>
              <Input value={workScheduleForm.finalDeliveryDate} onChange={handleWorkScheduleDateInput('finalDeliveryDate')} placeholder="2026.01.01" maxLength={10} className="text-sm" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
              <span>작업 시작일: {client.workStartDate || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
              <span>PC 시안일: {client.pcDraftDate || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
              <span>모바일 작업일: {client.mobileDraftDate || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
              <span>완성 전달일: {client.finalDeliveryDate || '—'}</span>
            </div>
          </div>
        )}
      </div>

      {/* 일정 (미팅 등) */}
      {linkedEvents.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            일정
            <span className="text-xs text-muted-foreground font-normal">({linkedEvents.length}건)</span>
          </h2>
          <div className="space-y-2">
            {linkedEvents.map((ev) => (
              <div key={ev.id} className="flex items-start justify-between gap-2 border border-border rounded-lg p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {ev.date}
                    </span>
                    {ev.isMeeting && (
                      <span className="flex items-center gap-1 text-teal-700 dark:text-teal-300">
                        <Clock className="w-3 h-3" />
                        미팅{ev.timeUnknown ? ' · 시간 미정' : ev.time ? ` · ${ev.time}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1 truncate">{ev.title}</p>
                  {ev.memo && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{ev.memo}</p>}
                </div>
                <button
                  onClick={() => handleDeleteLinkedEvent(ev.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors flex-shrink-0"
                  title="일정 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 할 일 (날짜 있는 것만) */}
      {linkedTodos.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-muted-foreground" />
            할 일
            <span className="text-xs text-muted-foreground font-normal">({linkedTodos.length}건)</span>
          </h2>
          <div className="space-y-2">
            {linkedTodos.map((t) => (
              <div key={t.id} className="flex items-center gap-2 border border-border rounded-lg p-3">
                <button
                  onClick={() => handleToggleLinkedTodo(t.id, t.completed)}
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    t.completed ? 'border-primary bg-primary' : 'border-input hover:border-primary'
                  }`}
                >
                  {t.completed && <Check className="w-3 h-3 text-primary-foreground" />}
                </button>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${TODO_PRIORITY_LABEL[t.priority].cls}`}>
                  {TODO_PRIORITY_LABEL[t.priority].label}
                </span>
                <span className={`text-sm flex-1 min-w-0 truncate ${t.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {t.content}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                  <CalendarDays className="w-3 h-3" />
                  {t.dueDate}
                </span>
                <button
                  onClick={() => handleDeleteLinkedTodo(t.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors flex-shrink-0"
                  title="할 일 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 홈페이지 제작 질문폼 */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
            질문폼
            {intakeForms.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">({intakeForms.length}건)</span>
            )}
          </h2>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setRequestChecklistDialogOpen(true)} className="gap-1 h-7 text-xs">
              <ClipboardCheck className="w-3.5 h-3.5" />
              전달받을 자료 안내
            </Button>
            <Button size="sm" onClick={handleOpenFormDialog} className="gap-1 h-7 text-xs">
              <Plus className="w-3.5 h-3.5" />
              링크 생성
            </Button>
          </div>
        </div>
        {intakeForms.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 만든 질문폼이 없어요. 고객에게 보낼 링크를 만들어보세요.</p>
        ) : (
          <div className="space-y-2">
            {intakeForms.map((f) => (
              <div key={f.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      f.status === 'submitted'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    }`}
                  >
                    {f.status === 'submitted' ? '제출완료' : '답변 대기중'}
                  </span>
                  <div className="flex items-center gap-1">
                    {f.status === 'pending' && (
                      <>
                        <button
                          onClick={() => window.open(`${window.location.origin}/f/${f.token}`, '_blank', 'noreferrer')}
                          className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="링크 바로가기"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopyFormLink(f.token)}
                          className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="링크 복사"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDeleteIntakeForm(f.id)}
                      disabled={deletingFormId === f.id}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors disabled:opacity-50"
                      title="삭제"
                    >
                      {deletingFormId === f.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                {f.status === 'submitted' ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">질문 {f.questions.length}개 · 답변 제출됨</p>
                    <Button size="sm" variant="outline" onClick={() => setViewingAnswersForm(f)} className="h-6 text-xs px-2">
                      답변 보기
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">질문 {f.questions.length}개 · 아직 답변 전이에요</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!viewingAnswersForm} onOpenChange={(open) => !open && setViewingAnswersForm(null)}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>질문폼 답변</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {viewingAnswersForm?.questions.map((q, i) => (
              <div key={i}>
                <p className="text-xs text-muted-foreground">{i + 1}. {q.text}{q.required && <span className="text-destructive"> *</span>}</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{viewingAnswersForm.answers[i] || '—'}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>질문폼 링크 생성</DialogTitle>
          </DialogHeader>

          {isClassifyingFields ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">AI가 질문 형태를 정리하고 있어요...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-border -mt-2">
                <div className="flex gap-1">
                  <button
                    onClick={() => setShowFormPreview(false)}
                    className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                      !showFormPreview ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    편집
                  </button>
                  <button
                    onClick={() => setShowFormPreview(true)}
                    className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                      showFormPreview ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    미리보기 ({formFields.length}개)
                  </button>
                </div>
              </div>

              {!showFormPreview ? (
                <div className="max-h-[440px] overflow-y-auto space-y-3 -mx-1 px-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSuggestQuestions}
                    disabled={isSuggestingQuestions}
                    className="w-full gap-1.5"
                  >
                    {isSuggestingQuestions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {isSuggestingQuestions ? 'AI가 상담 이력·메모를 분석 중이에요...' : 'AI 추가 질문 추천받기'}
                  </Button>
                  {formFields.map((f, i) => (
                    <div
                      key={i}
                      className={`border rounded-lg p-3 space-y-2 ${f.suggested ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
                    >
                      {f.suggested && (
                        <div className="flex items-start gap-1.5 text-[11px] text-primary">
                          <Sparkles className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span>AI 추천 {f.reason ? `· ${f.reason}` : ''}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Input
                          value={f.text}
                          onChange={(e) => updateFormField(i, { text: e.target.value })}
                          placeholder="질문 내용"
                          className="flex-1 h-8 text-sm"
                        />
                        <button
                          onClick={() => removeFormField(i)}
                          className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                          title="질문 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select value={f.type} onValueChange={(v) => updateFormField(i, { type: v as IntakeFieldType })}>
                          <SelectTrigger size="sm" className="w-[100px] h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(['text', 'textarea', 'select'] as const).map((t) => (
                              <SelectItem key={t} value={t}>{FIELD_TYPE_LABEL[t]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <Checkbox checked={f.required} onCheckedChange={(c) => updateFormField(i, { required: c === true })} />
                          필수
                        </label>
                      </div>
                      {f.type === 'select' && (
                        <div className="space-y-1.5 pl-1">
                          {f.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-1.5">
                              <Input
                                value={opt}
                                onChange={(e) => updateFieldOption(i, optIdx, e.target.value)}
                                placeholder={`선택지 ${optIdx + 1}`}
                                className="h-7 text-xs flex-1"
                              />
                              <button
                                onClick={() => removeFieldOption(i, optIdx)}
                                className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addFieldOption(i)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="w-3 h-3" />
                            선택지 추가
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addFormField} className="w-full gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    질문 추가
                  </Button>
                </div>
              ) : (
                <div className="max-h-[440px] overflow-y-auto border border-border rounded-lg p-4 bg-muted/20 space-y-4">
                  {formFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">아직 입력된 질문이 없어요.</p>
                  ) : (
                    formFields.map((f, i) => (
                      <div key={i}>
                        <p className="text-sm font-medium text-foreground mb-1.5">
                          {i + 1}. {f.text || '(질문 내용 없음)'}
                          {f.required && <span className="text-destructive"> *</span>}
                        </p>
                        {f.type === 'select' ? (
                          <div className="space-y-1">
                            {f.options.length === 0 ? (
                              <p className="text-xs text-muted-foreground">(선택지 없음)</p>
                            ) : (
                              f.options.map((opt, optIdx) => (
                                <div key={optIdx} className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="w-3 h-3 rounded-full border border-input flex-shrink-0" />
                                  {opt || '(빈 선택지)'}
                                </div>
                              ))
                            )}
                          </div>
                        ) : (
                          <div className={`rounded-md border border-dashed border-border bg-background ${f.type === 'textarea' ? 'h-16' : 'h-8'}`} />
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFormDialogOpen(false)}>취소</Button>
            <Button size="sm" onClick={handleCreateForm} disabled={isCreatingForm || isClassifyingFields} className="gap-1">
              {isCreatingForm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              링크 생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 제안서 연결 */}
      {isLoadingMatchedProposals ? (
        <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : matchedProposals.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            연결된 제안서
            <span className="text-xs text-muted-foreground font-normal">({matchedProposals.length}건)</span>
          </h2>
          <div className="space-y-2">
            {matchedProposals.map((doc) => (
              <div key={doc.id} className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                <div className="flex items-center justify-between p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {doc.title || doc.projectName || '(제목 없음)'}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {doc.date && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {doc.date}
                        </span>
                      )}
                      {doc.totalMin > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CircleDollarSign className="w-3 h-3" />
                          {doc.totalMin === doc.totalMax || doc.totalMax === 0
                            ? `${doc.totalMin.toLocaleString('ko-KR')}원`
                            : `${doc.totalMin.toLocaleString('ko-KR')} ~ ${doc.totalMax.toLocaleString('ko-KR')}원`}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/proposals/${doc.id}`)}
                    className="h-7 text-xs gap-1 flex-shrink-0 ml-3"
                  >
                    <ExternalLink className="w-3 h-3" />
                    보기
                  </Button>
                </div>

                {/* 메모 영역 */}
                <div className="border-t border-border/60 px-3 py-2.5 bg-muted/10">
                  {editingMemoId === doc.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={memoDraft}
                        onChange={e => setMemoDraft(e.target.value)}
                        rows={3}
                        className="w-full text-xs bg-background border border-input rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="메모를 입력하세요"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
                          onClick={() => setEditingMemoId(null)}>
                          취소
                        </Button>
                        <Button size="sm" className="h-6 text-xs px-2 gap-1"
                          disabled={savingMemoId === doc.id}
                          onClick={() => handleSaveMemo(doc.id)}>
                          {savingMemoId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          저장
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="w-full text-left group/memo"
                      onClick={() => { setEditingMemoId(doc.id); setMemoDraft(doc.memo ?? ''); }}
                    >
                      {doc.memo ? (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap group-hover/memo:text-foreground transition-colors"><Linkify text={doc.memo ?? ''} /></p>
                      ) : (
                        <p className="text-xs text-muted-foreground/40 italic group-hover/memo:text-muted-foreground transition-colors">메모 추가...</p>
                      )}
                    </button>
                  )}
                </div>

                {/* 문서 관리 */}
                <div className="border-t border-border/60 px-3 py-1.5 flex items-center justify-end gap-0.5 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const fullDoc = proposals.find((p) => p.id === String(doc.id));
                      if (fullDoc) setNotesDialogDoc(fullDoc);
                    }}
                    className="h-6 px-2 text-[11px] gap-1 text-violet-600 hover:text-violet-700"
                  >
                    <FileDown className="w-3 h-3" /> PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyDoc(doc.id, 'proposal')}
                    disabled={copyingDocId === String(doc.id)}
                    className="h-6 px-2 text-[11px] gap-1 text-sky-600 hover:text-sky-700"
                  >
                    {copyingDocId === String(doc.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                    복사
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicateAsEstimate(doc.id)}
                    disabled={duplicatingDocId === String(doc.id)}
                    className="h-6 px-2 text-[11px] gap-1"
                  >
                    {duplicatingDocId === String(doc.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                    견적서 변환
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDoc(doc.id, 'proposal')}
                    disabled={deletingDocId === String(doc.id)}
                    className="h-6 px-2 text-[11px] gap-1 text-destructive hover:text-destructive"
                  >
                    {deletingDocId === String(doc.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    삭제
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ClientAttachments clientId={clientId} />

      {/* 계약서 연동 */}
      {isLoadingMatchedEstimates ? (
        <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : matchedEstimates.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-muted-foreground" />
            연동 가능한 계약서
            <span className="text-xs text-muted-foreground font-normal">({matchedEstimates.length}건)</span>
          </h2>
          <div className="space-y-2">
            {matchedEstimates.map((est) => {
              const isSynced =
                syncedEstimateId === est.id ||
                (!!client.contractDate && client.contractDate === est.date && client.contractAmount === est.totalMin);
              return (
              <div key={est.id} className={`rounded-lg border overflow-hidden transition-colors ${isSynced ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-900/10' : 'border-border bg-muted/20'}`}>
                <div className="flex items-center justify-between p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{est.title || '(제목 없음)'}</p>
                      {isSynced && (
                        <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                          연동됨
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {est.date && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {est.date}
                        </span>
                      )}
                      {est.totalMin > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CircleDollarSign className="w-3 h-3" />
                          {est.totalMin.toLocaleString('ko-KR')}원
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0 ml-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/estimates/${est.id}`)}
                      className="h-7 text-xs gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      보기
                    </Button>
                    {isSynced ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSyncEstimate(est)}
                        disabled={syncingEstimateId === est.id}
                        className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
                      >
                        {syncingEstimateId === est.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <LinkIcon className="w-3 h-3" />}
                        재연동
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSyncEstimate(est)}
                        disabled={syncingEstimateId === est.id}
                        className="h-7 text-xs gap-1"
                      >
                        {syncingEstimateId === est.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <LinkIcon className="w-3 h-3" />}
                        연동
                      </Button>
                    )}
                  </div>
                </div>

                {/* 메모 영역 */}
                <div className="border-t border-border/60 px-3 py-2.5 bg-muted/10">
                  {editingMemoId === est.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={memoDraft}
                        onChange={e => setMemoDraft(e.target.value)}
                        rows={3}
                        className="w-full text-xs bg-background border border-input rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="메모를 입력하세요"
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
                          onClick={() => setEditingMemoId(null)}>
                          취소
                        </Button>
                        <Button size="sm" className="h-6 text-xs px-2 gap-1"
                          disabled={savingMemoId === est.id}
                          onClick={() => handleSaveMemo(est.id)}>
                          {savingMemoId === est.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          저장
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="w-full text-left group/memo"
                      onClick={() => { setEditingMemoId(est.id); setMemoDraft(est.memo ?? ''); }}
                    >
                      {est.memo ? (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap group-hover/memo:text-foreground transition-colors"><Linkify text={est.memo ?? ''} /></p>
                      ) : (
                        <p className="text-xs text-muted-foreground/40 italic group-hover/memo:text-muted-foreground transition-colors">메모 추가...</p>
                      )}
                    </button>
                  )}
                </div>

                {/* 문서 관리 */}
                <div className="border-t border-border/60 px-3 py-1.5 flex items-center justify-end gap-0.5 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const fullDoc = estimates.find((e) => e.id === String(est.id));
                      if (fullDoc) setNotesDialogDoc(fullDoc);
                    }}
                    className="h-6 px-2 text-[11px] gap-1 text-violet-600 hover:text-violet-700"
                  >
                    <FileDown className="w-3 h-3" /> PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyDoc(est.id, 'estimate')}
                    disabled={copyingDocId === String(est.id)}
                    className="h-6 px-2 text-[11px] gap-1 text-sky-600 hover:text-sky-700"
                  >
                    {copyingDocId === String(est.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                    복사
                  </Button>

                  {depositedSet.has(est.id) ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 px-1.5 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                      <CheckCircle2 className="w-3 h-3" /> 계약금
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDepositDialog(est.id, est.totalMax, client.name, 50)}
                      className="h-6 px-2 text-[11px] gap-1 text-amber-600 hover:text-amber-700"
                    >
                      <CreditCard className="w-3 h-3" /> 계약금
                    </Button>
                  )}

                  {finalPaidSet.has(est.id) ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-blue-600 px-1.5 py-1 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 whitespace-nowrap">
                      <CheckCircle2 className="w-3 h-3" /> 잔금
                    </span>
                  ) : depositedSet.has(est.id) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenFinalDialog(est.id, est.totalMax, client.name, 50)}
                      disabled={openingFinalId === est.id}
                      className="h-6 px-2 text-[11px] gap-1 text-blue-600 hover:text-blue-700"
                    >
                      {openingFinalId === est.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
                      잔금
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDoc(est.id, 'estimate')}
                    disabled={deletingDocId === String(est.id)}
                    className="h-6 px-2 text-[11px] gap-1 text-destructive hover:text-destructive"
                  >
                    {deletingDocId === String(est.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    삭제
                  </Button>
                </div>
              </div>
            );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-2">연동하면 계약일자와 계약금액이 계약서 정보로 업데이트됩니다.</p>
        </div>
      )}

      {/* 잔금 정산 — 완료 상태일 때만 표시 */}
      {client?.status === '완료' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 dark:bg-emerald-900/10 dark:border-emerald-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
              <CircleDollarSign className="w-4 h-4" />
              잔금 정산
            </h2>
            {!editingFinal && (
              <Button size="sm" variant="outline" onClick={() => setEditingFinal(true)} className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                <Edit className="w-3 h-3" />
                수정
              </Button>
            )}
          </div>

          {editingFinal ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">잔금 수령일</label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={finalPaymentDate}
                      onChange={e => {
                        const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                        let formatted = digits;
                        if (digits.length > 4) formatted = digits.slice(0, 4) + '.' + digits.slice(4);
                        if (digits.length > 6) formatted = digits.slice(0, 4) + '.' + digits.slice(4, 6) + '.' + digits.slice(6);
                        setFinalPaymentDate(formatted);
                      }}
                      placeholder="2026.06.30"
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
                          selected={parseDateString(finalPaymentDate)}
                          onSelect={date => {
                            if (!date) return;
                            const y = date.getFullYear();
                            const m = String(date.getMonth() + 1).padStart(2, '0');
                            const d = String(date.getDate()).padStart(2, '0');
                            setFinalPaymentDate(`${y}.${m}.${d}`);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">잔금 금액 (원)</label>
                  <Input
                    value={finalPaymentAmount}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setFinalPaymentAmount(raw ? Number(raw).toLocaleString('ko-KR') : '');
                    }}
                    placeholder="예: 1,250,000"
                    className="text-sm text-right"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                {client.finalPaymentDate && (
                  <Button size="sm" variant="outline" onClick={() => {
                    setFinalPaymentDate(client.finalPaymentDate ?? '');
                    setFinalPaymentAmount(client.finalPaymentAmount ? client.finalPaymentAmount.toLocaleString('ko-KR') : '');
                    setEditingFinal(false);
                  }} className="h-8 text-xs gap-1">
                    <X className="w-3.5 h-3.5" />
                    취소
                  </Button>
                )}
                <Button size="sm" onClick={handleSaveFinalPayment} disabled={isSavingFinal} className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isSavingFinal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  저장
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {client.finalPaymentDate ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">수령 완료</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="bg-white dark:bg-emerald-900/20 rounded-lg px-4 py-3 border border-emerald-200 dark:border-emerald-800">
                      <p className="text-[10px] text-muted-foreground mb-0.5">수령일</p>
                      <p className="text-sm font-semibold text-foreground">{client.finalPaymentDate}</p>
                    </div>
                    <div className="bg-white dark:bg-emerald-900/20 rounded-lg px-4 py-3 border border-emerald-200 dark:border-emerald-800">
                      <p className="text-[10px] text-muted-foreground mb-0.5">금액</p>
                      <p className="text-sm font-semibold text-foreground">
                        {client.finalPaymentAmount ? `${client.finalPaymentAmount.toLocaleString('ko-KR')}원` : '-'}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-1">월별 매출에 반영됩니다.</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">아직 잔금 수령 정보가 없습니다.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI 구성안 */}
      {client.siteStructures.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ListTree className="w-4 h-4 text-muted-foreground" />
              AI 구성안
              <span className="text-xs text-muted-foreground font-normal">({client.siteStructures.length}건)</span>
            </h2>
            <Button size="sm" variant="outline" onClick={() => setAiStructureDialogOpen(true)} className="gap-1 h-7 text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              구성안 추가
            </Button>
          </div>

          <div className="space-y-4">
            {client.siteStructures.map((entry, entryIdx) => (
              <SiteStructureEntryCard key={entry.id} clientId={clientId} entry={entry} index={entryIdx} />
            ))}
          </div>
        </div>
      )}

      {/* 상담 이력 */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            상담 이력
            {consultations.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">({consultations.length}건)</span>
            )}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setAiStructureDialogOpen(true)} className="gap-1 h-7 text-xs">
              <ListTree className="w-3.5 h-3.5" />
              AI 구성안 생성
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAiDraftDialogOpen(true)} className="gap-1 h-7 text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              AI 기반 제안서 생성
            </Button>
            <Button size="sm" onClick={handleNew} className="gap-1 h-7 text-xs">
              <Plus className="w-3.5 h-3.5" />
              추가
            </Button>
          </div>
        </div>

        {/* 추가/수정 폼 */}
        {showForm && (
          <div className="mb-4 p-4 border border-border rounded-lg bg-muted/30 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">상담일자</label>
                <div className="flex gap-1.5">
                  <Input
                    value={form.date}
                    onChange={handleDateInput}
                    placeholder="2025.01.15"
                    maxLength={10}
                    className="h-8 text-sm flex-1"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="h-8 w-8 flex items-center justify-center rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0">
                        <CalendarDays className="w-3.5 h-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        locale={ko}
                        month={calendarMonth}
                        onMonthChange={setCalendarMonth}
                        selected={parseDateString(form.date)}
                        onSelect={(date) => {
                          if (!date) return;
                          const y = date.getFullYear();
                          const m = String(date.getMonth() + 1).padStart(2, '0');
                          const d = String(date.getDate()).padStart(2, '0');
                          setForm((f) => ({ ...f, date: `${y}.${m}.${d}` }));
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">다음 액션</label>
                <Input
                  value={form.nextAction}
                  onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value }))}
                  placeholder="예: 다음주 제안서 전달, 견적 확인 요청..."
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">상담 내용 *</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={4}
                className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 resize-y min-h-[90px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                placeholder="상담 내용을 기록하세요..."
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel} className="gap-1 h-7 text-xs">
                <X className="w-3 h-3" /> 취소
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1 h-7 text-xs">
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                저장
              </Button>
            </div>
          </div>
        )}

        {/* 이력 목록 */}
        {isLoadingConsultations ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : consultations.length === 0 ? (
          <div className="text-center py-10">
            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">아직 상담 이력이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {consultations.map((c) => {
              const isExpanded = expandedId === c.id;
              return (
                <div key={c.id} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">{c.date}</span>
                        {c.nextAction && (
                          <span className="text-xs text-primary truncate">→ {c.nextAction}</span>
                        )}
                      </div>
                      <p className="text-sm text-foreground truncate mt-0.5">{c.content}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border bg-muted/20">
                      <p className="text-sm text-foreground whitespace-pre-wrap"><Linkify text={c.content} /></p>
                      {c.nextAction && (
                        <p className="text-xs text-primary mt-2 font-medium">→ 다음 액션: {c.nextAction}</p>
                      )}
                      <div className="flex justify-end gap-1 mt-3">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(c)} className="h-7 text-xs gap-1">
                          <Edit className="w-3 h-3" /> 수정
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="h-7 text-xs gap-1 text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3" /> 삭제
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedDocId && selectedDocData && (
        <DepositConfirmDialog
          key={`deposit-${selectedDocId}`}
          isOpen={depositDialogOpen}
          onClose={() => setDepositDialogOpen(false)}
          documentId={selectedDocId}
          totalAmount={selectedDocData.totalMax}
          depositRatio={selectedDocData.depositRatio}
          clientName={selectedDocData.clientName}
          onSuccess={handleDepositSuccess}
        />
      )}
      {selectedDocId && selectedDocData && (
        <FinalPaymentConfirmDialog
          key={`final-${selectedDocId}`}
          isOpen={finalDialogOpen}
          onClose={() => setFinalDialogOpen(false)}
          documentId={selectedDocId}
          totalAmount={selectedDocData.totalMax}
          depositAmount={finalDepositAmount}
          clientName={selectedDocData.clientName}
          onSuccess={handleFinalSuccess}
        />
      )}
      {notesDialogDoc && (
        <NotesEditPdfDialog
          doc={notesDialogDoc}
          isOpen={!!notesDialogDoc}
          onClose={() => setNotesDialogDoc(null)}
        />
      )}
      <AIEstimateDraftDialog
        isOpen={aiDraftDialogOpen}
        onClose={() => setAiDraftDialogOpen(false)}
        clientName={client.name}
        contactName={client.contactName}
        contactPhone={client.contactPhone}
        contactEmail={client.contactEmail}
        consultations={consultations}
      />
      <AISiteStructureDialog
        isOpen={aiStructureDialogOpen}
        onClose={() => setAiStructureDialogOpen(false)}
        clientId={clientId}
        consultations={consultations}
      />
      <ClientRequestChecklistDialog
        isOpen={requestChecklistDialogOpen}
        onClose={() => setRequestChecklistDialogOpen(false)}
        clientId={clientId}
        clientEmail={client.contactEmail}
        clientPhone={client.contactPhone}
      />
    </div>
  );
}
