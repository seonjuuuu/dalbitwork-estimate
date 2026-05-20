import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { type DocumentData, type DocumentItem, type DocumentType, type NotesMode, defaultProposal, defaultEstimate } from '@/lib/types';
import { nanoid } from 'nanoid';
import { trpc } from '@/lib/trpc';

interface EstimateContextType {
  currentDoc: DocumentData;
  setCurrentDoc: React.Dispatch<React.SetStateAction<DocumentData>>;
  proposals: DocumentData[];
  estimates: DocumentData[];
  newDocument: (type: DocumentType) => void;
  saveDocument: () => void;
  loadDocument: (id: string, type: DocumentType) => void;
  deleteDocument: (id: string, type: DocumentType) => void;
  addItem: () => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, field: keyof DocumentItem, value: string) => void;
  addNote: () => void;
  removeNote: (index: number) => void;
  updateNote: (index: number, value: string) => void;
  reorderNotes: (oldIndex: number, newIndex: number) => void;
  isSaving: boolean;
}

const EstimateContext = createContext<EstimateContextType | null>(null);

/** Convert a DB document row into the frontend DocumentData shape */
function dbDocToLocal(doc: {
  id: number;
  type: "proposal" | "estimate";
  title: string;
  memo: string | null;
  clientName: string;
  contactName: string;
  projectName: string;
  platform: string;
  date: string;
  items: { id: string; name: string; quantity: string; unitPrice?: string; originalPrice: string; discountPrice: string; discountAmount?: string }[];
  notes: string[];
  notesMode: "list" | "freeform";
  freeformNotes: string | null;
  totalMin: number;
  totalMax: number;
  contactPhone: string;
  businessType: string;
  optionalItems?: { id: string; name: string; description: string; quantity: string; price: string; payer: string }[];
  createdAt: Date | string;
  updatedAt: Date | string;
}): DocumentData {
  return {
    id: String(doc.id),
    type: doc.type,
    title: doc.title || '',
    memo: doc.memo || '',
    clientName: doc.clientName || '',
    contactName: doc.contactName || '',
    projectName: doc.projectName || '',
    platform: doc.platform || '',
    date: doc.date || '',
    items: (doc.items || []).map((item) => ({
      id: item.id || nanoid(),
      name: item.name || '',
      quantity: item.quantity || '',
      unitPrice: item.unitPrice || '',
      originalPrice: item.originalPrice || '',
      discountPrice: item.discountPrice || '',
      discountAmount: item.discountAmount || '',
    })),
    notes: doc.notes || [],
    notesMode: (doc.notesMode as NotesMode) || 'list',
    freeformNotes: doc.freeformNotes || null,
    templateVariables: (doc as any).templateVariables || null,
    totalMin: doc.totalMin || 0,
    totalMax: doc.totalMax || 0,
    contactPhone: doc.contactPhone || '',
    businessType: doc.businessType || '',
    optionalItems: (doc.optionalItems || []).map((item) => ({
      id: item.id || nanoid(),
      name: item.name || '',
      description: item.description || '',
      quantity: item.quantity || '',
      price: item.price || '',
      payer: item.payer || '',
    })),
    createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : new Date(doc.createdAt).toISOString(),
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : new Date(doc.updatedAt).toISOString(),
  };
}

export function EstimateProvider({ children }: { children: ReactNode }) {
  const [currentDoc, setCurrentDoc] = useState<DocumentData>(() => ({
    ...defaultProposal,
    id: '',
    title: '',
    memo: '',
    items: defaultProposal.items.map((item) => ({ ...item, id: nanoid() })),
    notes: [...defaultProposal.notes],
    notesMode: 'list',
    freeformNotes: null,
    templateVariables: null,
  }));

  const [isSaving, setIsSaving] = useState(false);

  // Fetch documents from DB via tRPC
  const proposalsQuery = trpc.documents.list.useQuery({ type: 'proposal' });
  const estimatesQuery = trpc.documents.list.useQuery({ type: 'estimate' });
  const utils = trpc.useUtils();

  // Convert DB results to local format
  const proposals: DocumentData[] = (proposalsQuery.data || []).map(dbDocToLocal);
  const estimates: DocumentData[] = (estimatesQuery.data || []).map(dbDocToLocal);

  // tRPC mutations
  const createMutation = trpc.documents.create.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate();
    },
  });

  const updateMutation = trpc.documents.update.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate();
    },
  });

  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate();
    },
  });

  const newDocument = useCallback((type: DocumentType) => {
    const template = type === 'proposal' ? defaultProposal : defaultEstimate;
    setCurrentDoc({
      ...template,
      id: '', // Empty ID means new document (not yet saved to DB)
      title: '',
      memo: '',
      date: new Date().toISOString().split('T')[0],
      items: template.items.map((item) => ({ ...item, id: nanoid() })),
      notes: [...template.notes],
      notesMode: 'list',
      freeformNotes: null,
      templateVariables: null,
    });
  }, []);

  const saveDocument = useCallback(async () => {
    setIsSaving(true);
    try {
      const payload = {
        type: currentDoc.type,
        title: currentDoc.title || '',
        memo: currentDoc.memo || null,
        clientName: currentDoc.clientName || '',
        projectName: currentDoc.projectName || '',
        platform: currentDoc.platform || '',
        date: currentDoc.date || '',
        items: currentDoc.items.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice || '',
          originalPrice: item.originalPrice,
          discountPrice: item.discountPrice,
          discountAmount: item.discountAmount || '',
        })),
        notes: currentDoc.notes,
        notesMode: currentDoc.notesMode,
        freeformNotes: currentDoc.freeformNotes,
        templateVariables: currentDoc.templateVariables,
        totalMin: currentDoc.totalMin,
        totalMax: currentDoc.totalMax,
        contactPhone: currentDoc.contactPhone || '',
        businessType: currentDoc.businessType || '',
      };

      const dbId = currentDoc.id ? parseInt(currentDoc.id) : NaN;

      if (!isNaN(dbId) && dbId > 0) {
        // Update existing document
        const result = await updateMutation.mutateAsync({
          id: dbId,
          data: payload,
        });
        if (result) {
          setCurrentDoc(dbDocToLocal(result));
        }
      } else {
        // Create new document
        const result = await createMutation.mutateAsync(payload);
        if (result) {
          setCurrentDoc(dbDocToLocal(result));
        }
      }
    } finally {
      setIsSaving(false);
    }
  }, [currentDoc, createMutation, updateMutation]);

  const loadDocument = useCallback((id: string, type: DocumentType) => {
    const list = type === 'proposal' ? proposals : estimates;
    const found = list.find((d) => d.id === id);
    if (found) {
      setCurrentDoc({
        ...found,
        items: found.items.map((item) => ({ ...item })),
        notes: [...found.notes],
        notesMode: found.notesMode || 'list',
        freeformNotes: found.freeformNotes || null,
        templateVariables: found.templateVariables || null,
      });
    }
  }, [proposals, estimates]);

  const deleteDocument = useCallback(async (id: string, type: DocumentType) => {
    const dbId = parseInt(id);
    if (isNaN(dbId)) return;
    await deleteMutation.mutateAsync({ id: dbId });
  }, [deleteMutation]);

  const addItem = useCallback(() => {
    setCurrentDoc((prev) => ({
      ...prev,
      items: [...prev.items, { id: nanoid(), name: '', quantity: '', originalPrice: '', discountPrice: '', discountAmount: '' }],
    }));
  }, []);

  const removeItem = useCallback((id: string) => {
    setCurrentDoc((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  }, []);

  const updateItem = useCallback((id: string, field: keyof DocumentItem, value: string) => {
    setCurrentDoc((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  }, []);

  const addNote = useCallback(() => {
    setCurrentDoc((prev) => ({
      ...prev,
      notes: [...prev.notes, ''],
    }));
  }, []);

  const removeNote = useCallback((index: number) => {
    setCurrentDoc((prev) => ({
      ...prev,
      notes: prev.notes.filter((_: string, i: number) => i !== index),
    }));
  }, []);

  const updateNote = useCallback((index: number, value: string) => {
    setCurrentDoc((prev) => ({
      ...prev,
      notes: prev.notes.map((note: string, i: number) => (i === index ? value : note)),
    }));
  }, []);

  const reorderNotes = useCallback((oldIndex: number, newIndex: number) => {
    setCurrentDoc((prev) => {
      const newNotes = [...prev.notes];
      const [removed] = newNotes.splice(oldIndex, 1);
      newNotes.splice(newIndex, 0, removed);
      return { ...prev, notes: newNotes };
    });
  }, []);

  return (
    <EstimateContext.Provider
      value={{
        currentDoc,
        setCurrentDoc,
        proposals,
        estimates,
        newDocument,
        saveDocument,
        loadDocument,
        deleteDocument,
        addItem,
        removeItem,
        updateItem,
        addNote,
        removeNote,
        updateNote,
        reorderNotes,
        isSaving,
      }}
    >
      {children}
    </EstimateContext.Provider>
  );
}

export function useEstimate() {
  const ctx = useContext(EstimateContext);
  if (!ctx) throw new Error('useEstimate must be used within EstimateProvider');
  return ctx;
}
