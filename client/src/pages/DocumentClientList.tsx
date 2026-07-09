import { useState } from 'react';
import { useLocation, useSearchParams } from 'wouter';
import { useEstimate } from '@/contexts/EstimateContext';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, FileText, Building2, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 10;

interface ClientDocRow {
  clientName: string;
  hasProposal: boolean;
  hasEstimate: boolean;
  latest: string;
}

export default function DocumentClientList() {
  const [, navigate] = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [currentPage, setCurrentPage] = useState(1);

  const { proposals, estimates, isLoadingDocuments } = useEstimate();
  const { data: clients = [] } = trpc.clients.list.useQuery(undefined);
  const clientIdByName = new Map(clients.map((c) => [c.name, c.id]));

  const rowsByClient = new Map<string, ClientDocRow>();
  const addDoc = (doc: typeof proposals[number], key: 'hasProposal' | 'hasEstimate') => {
    if (!doc.clientName) return;
    const latest = doc.updatedAt ?? doc.date;
    const row = rowsByClient.get(doc.clientName) ?? { clientName: doc.clientName, hasProposal: false, hasEstimate: false, latest: '' };
    row[key] = true;
    if (latest > row.latest) row.latest = latest;
    rowsByClient.set(doc.clientName, row);
  };
  proposals.forEach((doc) => addDoc(doc, 'hasProposal'));
  estimates.forEach((doc) => addDoc(doc, 'hasEstimate'));

  const rows = Array.from(rowsByClient.values()).sort((a, b) => b.latest.localeCompare(a.latest));

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set('q', value);
        else next.delete('q');
        return next;
      },
      { replace: true }
    );
  };

  const filteredRows = search.trim()
    ? rows.filter((r) => r.clientName.toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleRowClick = (clientName: string) => {
    const id = clientIdByName.get(clientName);
    if (id) navigate(`/clients/${id}`);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">제안서 · 계약서</h1>
          <p className="text-sm text-muted-foreground mt-1">고객사별로 보낸 제안서와 견적 및 계약서를 확인하세요.</p>
        </div>
      </div>

      <div className="relative mb-4 sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="고객사명으로 검색..."
          className="pl-9"
        />
      </div>

      {isLoadingDocuments ? (
        <div className="border border-border rounded-lg overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/4 ml-auto" />
            </div>
          ))}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-lg">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-muted-foreground text-sm">
            {search ? '검색 조건에 맞는 고객사가 없습니다.' : '아직 제안서나 견적서를 보낸 고객사가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <colgroup>
              <col className="w-1/2" />
              <col className="w-1/2" />
            </colgroup>
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">고객사명</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">구분</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row, idx) => {
                const clickable = clientIdByName.has(row.clientName);
                return (
                  <tr
                    key={row.clientName}
                    onClick={() => handleRowClick(row.clientName)}
                    className={`border-b border-border last:border-0 transition-colors ${idx % 2 !== 0 ? 'bg-muted/10' : ''} ${
                      clickable ? 'hover:bg-accent/30 cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <td className="px-4 py-3 max-w-0 text-left">
                      <span className="font-medium text-foreground truncate block">{row.clientName}</span>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {row.hasProposal && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                            제안서
                          </span>
                        )}
                        {row.hasEstimate && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                            견적및계약서
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoadingDocuments && filteredRows.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} / {filteredRows.length}개
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === safePage ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className="h-8 w-8 p-0 text-xs"
              >
                {page}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
