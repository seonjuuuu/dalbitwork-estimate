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
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 부모 value 변경 시 sync
  useEffect(() => {
    setSearch(value);
  }, [value]);

  const filtered = search
    ? clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : clients;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  };

  const handleSelect = (client: typeof clients[0]) => {
    setSearch(client.name);
    onSelect({ name: client.name, contactName: client.contactName, contactPhone: client.contactPhone });
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={search}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={`flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className ?? ''}`}
      />

      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden">
          {filtered.map((client) => (
            <button
              key={client.id}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(client); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
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
