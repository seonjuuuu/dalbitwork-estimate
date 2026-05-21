import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Boxes, Edit, Trash2, Plus, Save, X, Loader2, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface ServiceItemForm {
  name: string;
  description: string;
  unitPrice: string;
  category: string;
}

const emptyForm: ServiceItemForm = { name: '', description: '', unitPrice: '', category: '' };

const PRESET_CATEGORIES = ['페이지 제작', '기능 개발', '디자인', '유지보수', '기타'];

export default function ServiceItems() {
  const { data: items = [], isLoading, refetch } = trpc.serviceItems.list.useQuery();
  const createMutation = trpc.serviceItems.create.useMutation();
  const updateMutation = trpc.serviceItems.update.useMutation();
  const deleteMutation = trpc.serviceItems.delete.useMutation();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceItemForm>(emptyForm);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const handleEdit = (item: typeof items[0]) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description,
      unitPrice: item.unitPrice,
      category: item.category,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('서비스명을 입력해주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        unitPrice: form.unitPrice.replace(/,/g, ''),
        category: form.category.trim(),
      };
      if (editingId !== null) {
        await updateMutation.mutateAsync({ id: editingId, ...payload });
        toast.success('서비스가 수정되었습니다.');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('서비스가 추가되었습니다.');
      }
      await refetch();
      handleCancel();
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 서비스를 삭제하시겠습니까?')) return;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync({ id });
      await refetch();
      toast.success('삭제되었습니다.');
    } catch {
      toast.error('삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleUnitPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setForm((f) => ({ ...f, unitPrice: raw ? Number(raw).toLocaleString('ko-KR') : '' }));
  };

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.category || '미분류';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Boxes className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">서비스 항목</h1>
            <p className="text-sm text-muted-foreground mt-1">
              자주 사용하는 서비스를 등록해두고 견적서에 빠르게 추가하세요.
            </p>
          </div>
        </div>
        <Button onClick={handleNew} className="gap-2" size="sm">
          <Plus className="w-4 h-4" />
          서비스 추가
        </Button>
      </div>

      {/* 등록 / 수정 폼 */}
      {showForm && (
        <div className="mb-6 p-4 border border-border rounded-lg bg-card space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {editingId !== null ? '서비스 수정' : '새 서비스 등록'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">서비스명 *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="예: 메인 페이지 제작"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">단가 (원)</label>
              <Input
                value={form.unitPrice}
                onChange={handleUnitPriceChange}
                placeholder="예: 900,000"
                className="text-right"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">카테고리</label>
              <div className="flex gap-2">
                <Input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="예: 페이지 제작"
                />
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {PRESET_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setForm((f) => ({ ...f, category: cat }))}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                      form.category === cat
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">설명 (선택)</label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="예: 국문 기준, 5섹션"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleCancel} className="gap-1">
              <X className="w-3.5 h-3.5" /> 취소
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              저장
            </Button>
          </div>
        </div>
      )}

      {/* 서비스 목록 */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 border border-border rounded-lg animate-pulse">
              <div className="flex justify-between">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-4 bg-muted rounded w-16" />
              </div>
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Boxes className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-muted-foreground text-sm">등록된 서비스가 없습니다.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">위의 버튼으로 서비스를 추가해보세요.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([category, groupItems]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {category}
                </span>
              </div>
              <div className="space-y-1.5">
                {groupItems.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center justify-between p-3 border border-border rounded-lg hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{item.name}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground truncate">{item.description}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.unitPrice && (
                        <span className="text-sm font-semibold text-foreground">
                          {Number(item.unitPrice).toLocaleString('ko-KR')}원
                        </span>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          className="w-7 h-7 p-0"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="w-7 h-7 p-0 text-destructive hover:text-destructive"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
