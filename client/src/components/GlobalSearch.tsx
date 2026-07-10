import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useEstimate } from '@/contexts/EstimateContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Building2, FileText, FileCheck } from 'lucide-react';

const MAX_RESULTS = 8;

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [, navigate] = useLocation();
  const { proposals, estimates } = useEstimate();

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const handleOpenEvent = () => setOpen(true);
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('open-global-search', handleOpenEvent);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('open-global-search', handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const { data: clients = [] } = trpc.clients.list.useQuery(undefined, { enabled: open });

  const q = query.trim().toLowerCase();
  const matchedClients = q
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.contactName || '').toLowerCase().includes(q) ||
        (c.contactPhone || '').replace(/-/g, '').includes(q.replace(/-/g, '')) ||
        (c.businessNumber || '').replace(/-/g, '').includes(q.replace(/-/g, ''))
      ).slice(0, MAX_RESULTS)
    : [];
  const matchedProposals = q
    ? proposals.filter((d) => (d.title || '').toLowerCase().includes(q) || (d.clientName || '').toLowerCase().includes(q)).slice(0, MAX_RESULTS)
    : [];
  const matchedEstimates = q
    ? estimates.filter((d) => (d.title || '').toLowerCase().includes(q) || (d.clientName || '').toLowerCase().includes(q)).slice(0, MAX_RESULTS)
    : [];

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const hasResults = matchedClients.length > 0 || matchedProposals.length > 0 || matchedEstimates.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogHeader className="sr-only">
        <DialogTitle>통합 검색</DialogTitle>
        <DialogDescription>고객사, 제안서, 견적서를 검색하세요</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0 max-w-lg top-[20%] translate-y-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="고객사명, 문서 제목으로 검색..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {q === '' ? (
              <CommandEmpty>고객사명이나 문서 제목을 입력하세요.</CommandEmpty>
            ) : !hasResults ? (
              <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            ) : (
              <>
                {matchedClients.length > 0 && (
                  <CommandGroup heading="고객사">
                    {matchedClients.map((c) => (
                      <CommandItem key={`client-${c.id}`} onSelect={() => go(`/clients/${c.id}`)}>
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span>{c.name}</span>
                        {c.contactName && <span className="text-xs text-muted-foreground ml-2">{c.contactName}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {matchedProposals.length > 0 && (
                  <CommandGroup heading="제안서">
                    {matchedProposals.map((d) => (
                      <CommandItem key={`proposal-${d.id}`} onSelect={() => go(`/proposals/${d.id}`)}>
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span>{d.title || '(제목 없음)'}</span>
                        {d.clientName && <span className="text-xs text-muted-foreground ml-2">{d.clientName}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {matchedEstimates.length > 0 && (
                  <CommandGroup heading="견적 및 계약서">
                    {matchedEstimates.map((d) => (
                      <CommandItem key={`estimate-${d.id}`} onSelect={() => go(`/estimates/${d.id}`)}>
                        <FileCheck className="w-4 h-4 text-muted-foreground" />
                        <span>{d.title || '(제목 없음)'}</span>
                        {d.clientName && <span className="text-xs text-muted-foreground ml-2">{d.clientName}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
