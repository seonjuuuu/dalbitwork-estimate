import EstimateForm from '@/components/EstimateForm';
import EstimatePreview from '@/components/EstimatePreview';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { PenLine, Eye, Plus, FileText, Trash2 } from 'lucide-react';
import { useEstimate } from '@/contexts/EstimateContext';
import { getDocTypeLabel } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'form' | 'preview' | 'list'>('form');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('');
  const { currentDoc, proposals, estimates, newDocument, loadDocument, deleteDocument } = useEstimate();
  const docLabel = getDocTypeLabel(currentDoc.type);

  // 모든 문서 합치기
  const allDocuments = useMemo(() => [...proposals, ...estimates], [proposals, estimates]);

  // 고객사 목록 추출 (중복 제거)
  const clientList = useMemo(() => {
    const clients = new Set(allDocuments.map(doc => doc.clientName).filter(Boolean));
    return Array.from(clients).sort();
  }, [allDocuments]);

  // 필터링된 문서
  const filteredDocuments = useMemo(() => {
    if (!selectedClientFilter) return allDocuments;
    return allDocuments.filter(doc => doc.clientName === selectedClientFilter);
  }, [allDocuments, selectedClientFilter]);

  // 고객사별 그룹화
  const groupedByClient = useMemo(() => {
    const groups: Record<string, typeof allDocuments> = {};
    filteredDocuments.forEach(doc => {
      const client = doc.clientName || '(미지정)';
      if (!groups[client]) groups[client] = [];
      groups[client].push(doc);
    });
    return groups;
  }, [filteredDocuments]);

  const handleLoadDocument = (docId: string, docType: 'proposal' | 'estimate') => {
    loadDocument(docId, docType);
    setActiveTab('form');
  };

  const handleDeleteDocument = async (docId: string) => {
    const doc = allDocuments.find(d => d.id === docId);
    if (!doc) return;
    
    if (confirm(`"${doc.title || doc.clientName}" 문서를 삭제하시겠습니까?`)) {
      try {
        await deleteDocument(docId, doc.type);
        toast.success('문서가 삭제되었습니다.');
      } catch (err) {
        toast.error('삭제에 실패했습니다.');
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{docLabel} 작성</h1>
        <p className="text-sm text-muted-foreground mt-1">항목을 입력하고 미리보기에서 결과를 확인하세요.</p>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="flex gap-2 mb-4 xl:hidden">
        <Button
          variant={activeTab === 'form' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('form')}
          className="gap-1.5 flex-1"
        >
          <PenLine className="w-3.5 h-3.5" />
          작성
        </Button>
        <Button
          variant={activeTab === 'preview' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('preview')}
          className="gap-1.5 flex-1"
        >
          <Eye className="w-3.5 h-3.5" />
          미리보기
        </Button>
        <Button
          variant={activeTab === 'list' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('list')}
          className="gap-1.5 flex-1"
        >
          <FileText className="w-3.5 h-3.5" />
          목록
        </Button>
      </div>

      {/* Desktop: Side by Side */}
      <div className="hidden xl:grid xl:grid-cols-2 gap-6">
        <EstimateForm />
        <div className="sticky top-6 self-start">
          <EstimatePreview />
        </div>
      </div>

      {/* Mobile/Tablet: Tab Content */}
      <div className="xl:hidden">
        {activeTab === 'form' && <EstimateForm />}
        {activeTab === 'preview' && <EstimatePreview />}
        {activeTab === 'list' && <DocumentListView />}
      </div>

      {/* Desktop: Document List Sidebar */}
      <div className="hidden xl:block mt-6">
        <DocumentListSection
          groupedByClient={groupedByClient}
          clientList={clientList}
          selectedClientFilter={selectedClientFilter}
          onClientFilterChange={setSelectedClientFilter}
          onLoadDocument={handleLoadDocument}
          onDeleteDocument={handleDeleteDocument}
        />
      </div>
    </div>
  );

  function DocumentListView() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">문서 목록</h2>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                newDocument('proposal');
                setActiveTab('form');
              }}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              제안서
            </Button>
            <Button
              size="sm"
              onClick={() => {
                newDocument('estimate');
                setActiveTab('form');
              }}
              variant="outline"
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              견적서
            </Button>
          </div>
        </div>

        {/* Client Filter */}
        {clientList.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={selectedClientFilter === '' ? 'default' : 'outline'}
              onClick={() => setSelectedClientFilter('')}
              className="text-xs"
            >
              전체
            </Button>
            {clientList.map(client => (
              <Button
                key={client}
                size="sm"
                variant={selectedClientFilter === client ? 'default' : 'outline'}
                onClick={() => setSelectedClientFilter(client)}
                className="text-xs"
              >
                {client}
              </Button>
            ))}
          </div>
        )}

        {/* Document List */}
        <div className="space-y-3">
          {Object.entries(groupedByClient).map(([client, docs]) => (
            <div key={client} className="border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-3">{client}</h3>
              <div className="space-y-2">
                {docs.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2 bg-muted rounded-md hover:bg-muted/80 transition-colors"
                  >
                    <button
                      onClick={() => handleLoadDocument(doc.id!, doc.type)}
                      className="flex-1 text-left text-sm hover:text-primary transition-colors"
                    >
                      <div className="font-medium">{doc.title || `(제목 없음)`}</div>
                      <div className="text-xs text-muted-foreground">
                        {getDocTypeLabel(doc.type)} • {doc.projectName}
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(doc.id!)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(groupedByClient).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>저장된 문서가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    );
  }
}

function DocumentListSection({
  groupedByClient,
  clientList,
  selectedClientFilter,
  onClientFilterChange,
  onLoadDocument,
  onDeleteDocument,
}: {
  groupedByClient: Record<string, any[]>;
  clientList: string[];
  selectedClientFilter: string;
  onClientFilterChange: (client: string) => void;
  onLoadDocument: (docId: string, docType: 'proposal' | 'estimate') => void;
  onDeleteDocument: (docId: string) => void;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">문서 목록</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              새 문서
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>문서 유형 선택</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {}}>제안서</DropdownMenuItem>
            <DropdownMenuItem onClick={() => {}}>견적서</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Client Filter */}
      {clientList.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">고객사 필터</p>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => onClientFilterChange('')}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                selectedClientFilter === ''
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              전체
            </button>
            {clientList.map(client => (
              <button
                key={client}
                onClick={() => onClientFilterChange(client)}
                className={`px-2 py-1 rounded text-xs transition-colors truncate max-w-[100px] ${
                  selectedClientFilter === client
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                title={client}
              >
                {client}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Document List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {Object.entries(groupedByClient).length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">저장된 문서가 없습니다.</p>
        ) : (
          Object.entries(groupedByClient).map(([client, docs]) => (
            <div key={client} className="space-y-1">
              <p className="text-xs font-semibold text-foreground px-1">{client}</p>
              {docs.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-2 bg-muted rounded hover:bg-muted/80 transition-colors group"
                >
                  <button
                    onClick={() => onLoadDocument(doc.id!, doc.type)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="text-xs font-medium truncate hover:text-primary">
                      {doc.title || '(제목 없음)'}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {getDocTypeLabel(doc.type)}
                    </div>
                  </button>
                  <button
                    onClick={() => onDeleteDocument(doc.id!)}
                    className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
