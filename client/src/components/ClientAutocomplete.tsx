import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Building2, Check } from 'lucide-react';

interface ClientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (client: { name: string; contactName: string; contactPhone: string }) => void;
  placeholder?: string;
  className?: string;
}

export default function ClientAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
}: ClientAutocompleteProps) {
  const { data: clients = [] } = trpc.clients.list.useQuery();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  // 드롭다운 열릴 때마다 포커스 인덱스 초기화
  useEffect(() => {
    if (!open) setActiveIndex(-1);
  }, [open]);

  // 활성 항목이 보이도록 스크롤
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[activeIndex] as HTMLElement;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const filtered = search
    ? clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : clients;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    onChange(e.target.value);
    setActiveIndex(-1);
    setOpen(true);
  };

  const handleSelect = (client: typeof clients[0]) => {
    setSearch(client.name);
    onSelect({ name: client.name, contactName: client.contactName, contactPhone: client.contactPhone });
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) {
      if (e.key === 'ArrowDown' && filtered.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        e.preventDefault();
        handleSelect(filtered[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={search}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-expanded={open && filtered.length > 0}
        aria-activedescendant={activeIndex >= 0 ? `client-option-${activeIndex}` : undefined}
        className={`flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className ?? ''}`}
      />

      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden max-h-52 overflow-y-auto"
        >
          {filtered.map((client, idx) => (
            <button
              key={client.id}
              id={`client-option-${idx}`}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(client); }}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                idx === activeIndex ? 'bg-accent' : 'hover:bg-accent'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                {(client.contactName || client.contactPhone) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {[client.contactName, client.contactPhone].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              {client.name === value && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
