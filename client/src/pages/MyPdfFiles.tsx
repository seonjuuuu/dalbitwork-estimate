import { useRef, useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Upload, Download, Trash2, FileText, Loader2, Eye, ExternalLink } from 'lucide-react';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date | string) {
  const date = new Date(d);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export default function MyPdfFiles() {
  const { data: files = [], refetch, isLoading } = trpc.pdfFiles.list.useQuery();
  const uploadMutation = trpc.pdfFiles.upload.useMutation();
  const deleteMutation = trpc.pdfFiles.delete.useMutation();
  const getPdfMutation = trpc.pdfFiles.get.useMutation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [previewingId, setPreviewingId] = useState<number | null>(null);

  // blob URL 메모리 해제
  useEffect(() => {
    return () => { if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl); };
  }, [previewBlobUrl]);

  const handlePreview = async (id: number, name: string) => {
    setPreviewingId(id);
    try {
      const row = await getPdfMutation.mutateAsync({ id });
      if (!row) { toast.error('파일을 찾을 수 없습니다.'); return; }
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
      const blob = new Blob([Uint8Array.from(atob(row.data), c => c.charCodeAt(0))], { type: 'application/pdf' });
      setPreviewBlobUrl(URL.createObjectURL(blob));
      setPreviewName(name);
    } catch {
      toast.error('미리보기에 실패했습니다.');
    } finally {
      setPreviewingId(null);
    }
  };

  const closePreview = () => {
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    setPreviewBlobUrl(null);
    setPreviewName('');
  };

  const handleFiles = async (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    const file = selected[0];

    if (file.type !== 'application/pdf') {
      toast.error('PDF 파일만 업로드 가능합니다.');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('파일 크기는 10MB 이하만 가능합니다.');
      return;
    }

    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // strip data:application/pdf;base64, prefix
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await uploadMutation.mutateAsync({
        name: file.name,
        fileSize: file.size,
        data: base64,
      });
      await refetch();
      toast.success(`"${file.name}" 업로드 완료`);
    } catch {
      toast.error('업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (id: number, name: string) => {
    setDownloadingId(id);
    try {
      const row = await getPdfMutation.mutateAsync({ id });
      if (!row) { toast.error('파일을 찾을 수 없습니다.'); return; }
      const blob = new Blob([Uint8Array.from(atob(row.data), c => c.charCodeAt(0))], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('다운로드에 실패했습니다.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}"을 삭제하시겠습니까?`)) return;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync({ id });
      await refetch();
      toast.success('삭제됐습니다.');
    } catch {
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">내 PDF 파일</h1>
        <p className="text-sm text-muted-foreground mt-1">자주 사용하는 안내 PDF를 업로드해 두고 필요할 때 다운로드하세요.</p>
      </div>

      {/* 업로드 영역 */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/30'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">업로드 중...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">클릭하거나 PDF를 여기에 끌어다 놓으세요</p>
            <p className="text-xs text-muted-foreground">PDF 파일만 가능 · 최대 10MB</p>
          </div>
        )}
      </div>

      {/* 파일 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">업로드된 파일이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:bg-accent/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4.5 h-4.5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatBytes(file.fileSize)} · {formatDate(file.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => handlePreview(file.id, file.name)}
                  disabled={previewingId === file.id}
                >
                  {previewingId === file.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Eye className="w-3.5 h-3.5" />}
                  미리보기
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => handleDownload(file.id, file.name)}
                  disabled={downloadingId === file.id}
                >
                  {downloadingId === file.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                  다운로드
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(file.id, file.name)}
                  disabled={deletingId === file.id}
                >
                  {deletingId === file.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* 미리보기 다이얼로그 */}
      <Dialog open={!!previewBlobUrl} onOpenChange={open => { if (!open) closePreview(); }}>
        <DialogContent className="max-w-4xl w-[90vw] h-[90vh] flex flex-col p-0 gap-0">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0 pr-12">
            <p className="text-sm font-medium text-foreground truncate flex-1">{previewName}</p>
            <a
              href={previewBlobUrl ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              새 탭으로 열기
            </a>
          </div>
          {previewBlobUrl && (
            <iframe
              src={previewBlobUrl}
              className="flex-1 w-full border-0"
              title={previewName}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
