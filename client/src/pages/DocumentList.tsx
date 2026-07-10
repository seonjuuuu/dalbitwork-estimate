import { useEstimate } from '@/contexts/EstimateContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import DocumentRowActions from '@/components/DocumentRowActions';
import DepositFinalCell from '@/components/DepositFinalCell';
import { FileText, FileCheck, Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useLocation, useSearchParams } from 'wouter';
import { type DocumentType, getDocTypeLabel } from '@/lib/types';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

const PAGE_SIZE = 10;

interface DocumentListProps {
  type: DocumentType;
}

export default function DocumentList({ type }: DocumentListProps) {
  const { proposals, estimates, isLoadingDocuments } = useEstimate();
  const [, navigate] = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'not_started'>('all');
  const [dateSort, setDateSort] = useState<'asc' | 'desc' | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');

  const { data: depositedIds = [], isLoading: isLoadingDepositedIds } = trpc.documents.getDepositedDocumentIds.useQuery(undefined, { enabled: type === 'estimate' });
  const { data: finalPaidIds = [], isLoading: isLoadingFinalPaidIds } = trpc.documents.getFinalPaidDocumentIds.useQuery(undefined, { enabled: type === 'estimate' });
  const isLoadingPaymentStatus = isLoadingDepositedIds || isLoadingFinalPaidIds;
  const depositedSet = new Set(depositedIds);
  const finalPaidSet = new Set(finalPaidIds);

  const { data: clients = [] } = trpc.clients.list.useQuery(undefined);
  const clientIdByName = new Map(clients.map((c) => [c.name, c.id]));

  const documents = type === 'proposal' ? proposals : estimates;
  const docLabel = getDocTypeLabel(type);
  const IconComponent = type === 'proposal' ? FileText : FileCheck;

  // 계약금/잔금 완납 여부에 따른 진행 상태 (견적 및 계약서 목록에서만 의미 있음)
  const filteredDocuments = documents.filter((doc) => {
    if (type === 'estimate' && statusFilter !== 'all') {
      const docIdNum = parseInt(doc.id!);
      const isDeposited = depositedSet.has(docIdNum);
      const isFinalPaid = finalPaidSet.has(docIdNum);
      const status: 'completed' | 'in_progress' | 'not_started' = isFinalPaid ? 'completed' : isDeposited ? 'in_progress' : 'not_started';
      if (status !== statusFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (!(doc.clientName || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sortedDocuments = dateSort
    ? [...filteredDocuments].sort((a, b) => (dateSort === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)))
    : filteredDocuments;

  const totalPages = Math.max(1, Math.ceil(sortedDocuments.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedDocs = sortedDocuments.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleToggleDateSort = () => {
    setDateSort((prev) => (prev === null ? 'desc' : prev === 'desc' ? 'asc' : null));
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (status: 'all' | 'completed' | 'in_progress' | 'not_started') => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
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

  const handleResetFilters = () => {
    setStatusFilter('all');
    handleSearchChange('');
  };

  const handleEdit = (id: string) => {
    navigate(type === 'proposal' ? `/proposals/${id}` : `/estimates/${id}`);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <IconComponent className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{docLabel} 목록</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoadingDocuments
              ? '불러오는 중...'
              : statusFilter !== 'all' || searchQuery.trim()
                ? `총 ${documents.length}개 중 ${filteredDocuments.length}개`
                : `총 ${documents.length}개`}
          </p>
        </div>
      </div>

      {!isLoadingDocuments && documents.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          {type === 'estimate' && (
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              {([
                { key: 'all', label: '전체' },
                { key: 'completed', label: '완료' },
                { key: 'in_progress', label: '진행중' },
                { key: 'not_started', label: '미진행' },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleStatusFilterChange(opt.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    statusFilter === opt.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          <div className="relative sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="회사이름 검색"
              className="pl-8 h-8 text-sm"
            />
          </div>
          {(statusFilter !== 'all' || searchQuery.trim()) && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1.5 bg-background hover:bg-muted transition-colors"
            >
              초기화
            </button>
          )}
        </div>
      )}

      {isLoadingDocuments ? (
        <div className="border border-border rounded-lg overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/5" />
              <div className="h-4 bg-muted rounded w-1/6" />
              <div className="h-4 bg-muted rounded w-1/6 ml-auto" />
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-lg">
          <IconComponent className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-muted-foreground">아직 {docLabel}가 없습니다.</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-lg">
          <IconComponent className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <p className="text-muted-foreground">검색 조건에 맞는 {docLabel}가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[4%]" />
                <col className={type === 'estimate' ? 'w-[18%]' : 'w-[22%]'} />
                <col className={type === 'estimate' ? 'w-[12%]' : 'w-[15%]'} />
                <col className={type === 'estimate' ? 'w-[9%]' : 'w-[11%]'} />
                <col className={type === 'estimate' ? 'w-[12%]' : 'w-[14%]'} />
                {type === 'estimate' && <col className="w-[11%]" />}
                {type === 'estimate' && <col className="w-[11%]" />}
                <col className={type === 'estimate' ? 'w-[23%]' : 'w-[33%]'} />
              </colgroup>
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">No.</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">제목</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">고객사</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">
                    <button
                      onClick={handleToggleDateSort}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      날짜
                      {dateSort === 'asc' ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : dateSort === 'desc' ? (
                        <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  </th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">금액</th>
                  {type === 'estimate' && (
                    <>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">계약금</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5">잔금</th>
                    </>
                  )}
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">작업</th>
                </tr>
              </thead>
              <tbody>
                {pagedDocs.map((doc, idx) => {
                  const rowNumber = (safePage - 1) * PAGE_SIZE + idx + 1;
                  const clientId = doc.clientName ? clientIdByName.get(doc.clientName) : undefined;

                  return (
                    <tr
                      key={doc.id}
                      className={`border-b border-border last:border-0 hover:bg-accent/30 transition-colors ${idx % 2 !== 0 ? 'bg-muted/10' : ''}`}
                    >
                      {/* 번호 */}
                      <td className="px-3 py-3 text-left text-muted-foreground">{rowNumber}</td>

                      {/* 제목 */}
                      <td className="px-4 py-3 max-w-0 text-left">
                        <button
                          onClick={() => handleEdit(doc.id!)}
                          className="font-medium text-foreground hover:text-primary truncate block text-left w-full"
                        >
                          {doc.title || '(제목 없음)'}
                        </button>
                      </td>

                      {/* 고객사 */}
                      <td className="px-3 py-3 max-w-0 text-left">
                        {doc.clientName && clientId ? (
                          <button
                            onClick={() => navigate(`/clients/${clientId}`)}
                            className="text-muted-foreground hover:text-primary hover:underline truncate block text-left w-full"
                          >
                            {doc.clientName}
                          </button>
                        ) : (
                          <span className="text-muted-foreground truncate block text-left">
                            {doc.clientName || '—'}
                          </span>
                        )}
                      </td>

                      {/* 날짜 */}
                      <td className="px-3 py-3 whitespace-nowrap text-left">
                        <span className="text-muted-foreground">{doc.date}</span>
                      </td>

                      {/* 금액 */}
                      <td className="px-3 py-3 text-left">
                        <span className="text-foreground/80">
                          {(doc.totalMax || doc.totalMin).toLocaleString('ko-KR')}원
                        </span>
                      </td>

                      {type === 'estimate' && (
                        <>
                          {/* 계약금 */}
                          <td className="px-3 py-3 text-left">
                            {isLoadingPaymentStatus ? (
                              <span className="text-xs text-muted-foreground">불러오는 중...</span>
                            ) : (
                              <DepositFinalCell
                                kind="deposit"
                                docId={parseInt(doc.id!)}
                                totalMax={doc.totalMax}
                                clientName={doc.clientName}
                                depositRatio={doc.depositRatio}
                              />
                            )}
                          </td>

                          {/* 잔금 */}
                          <td className="px-3 py-3 text-left">
                            {isLoadingPaymentStatus ? (
                              <span className="text-xs text-muted-foreground">불러오는 중...</span>
                            ) : (
                              <DepositFinalCell
                                kind="final"
                                docId={parseInt(doc.id!)}
                                totalMax={doc.totalMax}
                                clientName={doc.clientName}
                                depositRatio={doc.depositRatio}
                              />
                            )}
                          </td>
                        </>
                      )}

                      {/* 작업 버튼 */}
                      <td className="px-4 py-3">
                        <DocumentRowActions
                          docId={parseInt(doc.id!)}
                          docType={type}
                          totalMax={doc.totalMax}
                          clientName={doc.clientName}
                          depositRatio={doc.depositRatio}
                          showDepositFinal={false}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredDocuments.length)} / {filteredDocuments.length}개
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
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
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
