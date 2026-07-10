import EstimateForm from '@/components/EstimateForm';
import EstimatePreview from '@/components/EstimatePreview';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PenLine, Eye } from 'lucide-react';
import { useEstimate } from '@/contexts/EstimateContext';
import { getDocTypeLabel } from '@/lib/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  const { currentDoc } = useEstimate();
  const docLabel = getDocTypeLabel(currentDoc.type);

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
      </div>
    </div>
  );
}
