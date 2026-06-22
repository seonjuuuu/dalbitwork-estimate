import { useEffect, useRef } from 'react';
import { useEstimate } from '@/contexts/EstimateContext';
import { type DocumentType } from '@/lib/types';
import Home from './Home';
import { Loader2 } from 'lucide-react';

interface Props {
  id: string;
  type: DocumentType;
}

export default function DocumentEdit({ id, type }: Props) {
  const { loadDocument, proposals, estimates } = useEstimate();
  const loaded = useRef(false);

  const list = type === 'proposal' ? proposals : estimates;
  const docFound = list.some((d) => d.id === String(id));

  useEffect(() => {
    if (!id || loaded.current) return;
    if (!docFound) return;

    loadDocument(id, type);
    loaded.current = true;
  }, [id, type, docFound, list]);

  if (!loaded.current && !docFound) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Home />;
}
