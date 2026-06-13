import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileDown, Plus, Trash2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import NotesPdfDocument from '@/components/NotesPdfDocument';
import type { DocumentData } from '@/lib/types';
import { toast } from 'sonner';

interface Props {
  doc: DocumentData;
  isOpen: boolean;
  onClose: () => void;
}

export default function NotesEditPdfDialog({ doc, isOpen, onClose }: Props) {
  const isFreeform = doc.notesMode === 'freeform';

  const [notes, setNotes] = useState<string[]>(() => [...(doc.notes || [])]);
  const [freeformNotes, setFreeformNotes] = useState(doc.freeformNotes || '');
  const [isDownloading, setIsDownloading] = useState(false);

  const addNote = () => setNotes(prev => [...prev, '']);
  const removeNote = (i: number) => setNotes(prev => prev.filter((_, idx) => idx !== i));
  const updateNote = (i: number, val: string) => setNotes(prev => prev.map((n, idx) => idx === i ? val : n));

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const editedDoc: DocumentData = {
        ...doc,
        notes: isFreeform ? doc.notes : notes,
        freeformNotes: isFreeform ? freeformNotes : doc.freeformNotes,
      };
      const blob = await pdf(<NotesPdfDocument doc={editedDoc} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `참고사항_${doc.clientName || doc.title || 'notes'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('PDF 생성에 실패했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>참고사항 PDF 편집</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {doc.clientName && <span className="font-medium">{doc.clientName}</span>}
            {doc.clientName && doc.title && ' · '}
            {doc.title}
            <span className="ml-1 text-muted-foreground/60">(PDF 전용 수정 — 원본 문서에는 저장되지 않습니다)</span>
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-2 min-h-0">
          {isFreeform ? (
            <Textarea
              value={freeformNotes}
              onChange={e => setFreeformNotes(e.target.value)}
              className="min-h-[400px] text-sm font-mono resize-none"
              placeholder="참고사항 내용을 입력하세요..."
            />
          ) : (
            <div className="space-y-2">
              {notes.map((note, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground pt-2 w-5 flex-shrink-0 text-right">{i + 1}.</span>
                  <Input
                    value={note}
                    onChange={e => updateNote(i, e.target.value)}
                    className="flex-1 text-sm"
                    placeholder={`항목 ${i + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeNote(i)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs w-full mt-1"
                onClick={addNote}
              >
                <Plus className="w-3.5 h-3.5" />
                항목 추가
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={isDownloading}>닫기</Button>
          <Button onClick={handleDownload} disabled={isDownloading} className="gap-2">
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            PDF 다운로드
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
