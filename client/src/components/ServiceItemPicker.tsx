import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Tag, Boxes } from 'lucide-react';

interface ServiceItemPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: { name: string; unitPrice: string; originalPrice: string }) => void;
}

export default function ServiceItemPicker({ isOpen, onClose, onSelect }: ServiceItemPickerProps) {
  const { data: items = [] } = trpc.serviceItems.list.useQuery(undefined, { enabled: isOpen });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));

  const filtered = items.filter((item) => {
    const matchSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !selectedCategory || item.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  const grouped = filtered.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.category || '미분류';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const handleSelect = (item: typeof items[0]) => {
    const price = item.unitPrice ? Number(item.unitPrice).toLocaleString('ko-KR') : '';
    onSelect({
      name: item.name,
      unitPrice: price,
      originalPrice: price,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[680px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="w-4.5 h-4.5 text-primary" />
            서비스 항목 추가
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="서비스명으로 검색..."
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* 카테고리 필터 */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedCategory === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                전체
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    selectedCategory === cat
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* 목록 */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {items.length === 0 ? (
              <div className="text-center py-10">
                <Boxes className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">등록된 서비스가 없습니다.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">사이드바의 서비스 항목 메뉴에서 먼저 등록해주세요.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
              </div>
            ) : (
              Object.entries(grouped).map(([category, groupItems]) => (
                <div key={category}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Tag className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {category}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {groupItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className="w-full flex items-center justify-between p-3 rounded-md border border-border hover:bg-accent hover:border-primary/30 transition-colors text-left group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
                            {item.description && (
                              <span className="text-xs text-muted-foreground truncate">{item.description}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          {item.unitPrice && (
                            <span className="text-sm font-semibold text-foreground">
                              {Number(item.unitPrice).toLocaleString('ko-KR')}원
                            </span>
                          )}
                          <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
