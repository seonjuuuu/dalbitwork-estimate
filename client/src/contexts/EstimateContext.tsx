import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { type DocumentData, type DocumentItem, type DocumentType, defaultProposal, defaultEstimate } from '@/lib/types';
import { nanoid } from 'nanoid';

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
}

const EstimateContext = createContext<EstimateContextType | null>(null);

function loadFromStorage(key: string): DocumentData[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveToStorage(key: string, data: DocumentData[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function EstimateProvider({ children }: { children: ReactNode }) {
  const [currentDoc, setCurrentDoc] = useState<DocumentData>(() => ({
    ...defaultProposal,
    id: nanoid(),
    title: '',
    memo: '',
    items: defaultProposal.items.map((item) => ({ ...item, id: nanoid() })),
    notes: [...defaultProposal.notes],
  }));

  const [proposals, setProposals] = useState<DocumentData[]>(() => loadFromStorage('dalbitwork_proposals'));
  const [estimates, setEstimates] = useState<DocumentData[]>(() => loadFromStorage('dalbitwork_estimates'));

  const newDocument = useCallback((type: DocumentType) => {
    const template = type === 'proposal' ? defaultProposal : defaultEstimate;
    setCurrentDoc({
      ...template,
      id: nanoid(),
      title: '',
      memo: '',
      date: new Date().toISOString().split('T')[0],
      items: template.items.map((item) => ({ ...item, id: nanoid() })),
      notes: [...template.notes],
    });
  }, []);

  const saveDocument = useCallback(() => {
    const now = new Date().toISOString();
    const docToSave: DocumentData = {
      ...currentDoc,
      id: currentDoc.id || nanoid(),
      createdAt: currentDoc.createdAt || now,
      updatedAt: now,
    };

    if (currentDoc.type === 'proposal') {
      setProposals((prev) => {
        const existing = prev.findIndex((p) => p.id === docToSave.id);
        const updated = existing >= 0
          ? prev.map((p) => (p.id === docToSave.id ? docToSave : p))
          : [docToSave, ...prev];
        saveToStorage('dalbitwork_proposals', updated);
        return updated;
      });
    } else {
      setEstimates((prev) => {
        const existing = prev.findIndex((e) => e.id === docToSave.id);
        const updated = existing >= 0
          ? prev.map((e) => (e.id === docToSave.id ? docToSave : e))
          : [docToSave, ...prev];
        saveToStorage('dalbitwork_estimates', updated);
        return updated;
      });
    }

    setCurrentDoc(docToSave);
  }, [currentDoc]);

  const loadDocument = useCallback((id: string, type: DocumentType) => {
    const list = type === 'proposal' ? proposals : estimates;
    const found = list.find((d) => d.id === id);
    if (found) {
      setCurrentDoc({
        ...found,
        items: found.items.map((item) => ({ ...item })),
        notes: [...found.notes],
      });
    }
  }, [proposals, estimates]);

  const deleteDocument = useCallback((id: string, type: DocumentType) => {
    if (type === 'proposal') {
      setProposals((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        saveToStorage('dalbitwork_proposals', updated);
        return updated;
      });
    } else {
      setEstimates((prev) => {
        const updated = prev.filter((e) => e.id !== id);
        saveToStorage('dalbitwork_estimates', updated);
        return updated;
      });
    }
  }, []);

  const addItem = useCallback(() => {
    setCurrentDoc((prev) => ({
      ...prev,
      items: [...prev.items, { id: nanoid(), name: '', quantity: '', originalPrice: '', discountPrice: '' }],
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
