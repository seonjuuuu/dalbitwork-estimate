import { eq, and, or, ne, desc, asc, gte, lte, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { InsertUser, users, documents, InsertDocument, noteTemplates, InsertNoteTemplate, payments, serviceItems, clients, consultations, hktbInvoices, pdfFiles } from "../drizzle/schema";
import type { InsertPayment, InsertServiceItem, InsertClient, InsertConsultation, InsertHktbInvoice, InsertPdfFile } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL);
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach(field => {
    if (user[field] === undefined) return;
    values[field] = user[field] ?? null;
    updateSet[field] = user[field] ?? null;
  });

  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Document CRUD ───────────────────────────────────────────────

export async function listDocuments(userId: number, type?: "proposal" | "estimate") {
  const db = await getDb();
  if (!db) return [];
  const conditions = type
    ? and(eq(documents.userId, userId), eq(documents.type, type))
    : eq(documents.userId, userId);
  return db.select().from(documents).where(conditions).orderBy(desc(documents.updatedAt));
}

export async function getDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.userId, userId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createDocument(data: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(documents).values(data).returning({ id: documents.id });
  return getDocumentById(inserted.id);
}

export async function updateDocument(id: number, userId: number, data: Partial<Omit<InsertDocument, "id" | "userId" | "createdAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(documents).set(data).where(and(eq(documents.id, id), eq(documents.userId, userId)));
  return getDocument(id, userId);
}

export async function deleteDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
  return { success: true };
}

async function getDocumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Note Template CRUD ──────────────────────────────────────────

export async function listNoteTemplates(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(noteTemplates).where(eq(noteTemplates.userId, userId)).orderBy(asc(noteTemplates.sortOrder), desc(noteTemplates.createdAt));
}

export async function getNoteTemplate(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(noteTemplates).where(and(eq(noteTemplates.id, id), eq(noteTemplates.userId, userId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createNoteTemplate(data: InsertNoteTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(noteTemplates).values(data).returning({ id: noteTemplates.id });
  return getNoteTemplateById(inserted.id);
}

export async function updateNoteTemplate(id: number, userId: number, data: Partial<Omit<InsertNoteTemplate, "id" | "userId" | "createdAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(noteTemplates).set(data).where(and(eq(noteTemplates.id, id), eq(noteTemplates.userId, userId)));
  return getNoteTemplate(id, userId);
}

export async function deleteNoteTemplate(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(noteTemplates).where(and(eq(noteTemplates.id, id), eq(noteTemplates.userId, userId)));
  return { success: true };
}

async function getNoteTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(noteTemplates).where(eq(noteTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Payment CRUD ────────────────────────────────────────────────

export async function createPayment(data: InsertPayment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(payments).values(data).returning({ id: payments.id });
  return getPaymentById(inserted.id);
}

export async function getDocumentPayments(documentId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(and(eq(payments.documentId, documentId), eq(payments.userId, userId))).orderBy(desc(payments.paymentDate));
}

export async function getDepositedDocumentIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ documentId: payments.documentId })
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.type, 'deposit')));
  return rows.map(r => r.documentId);
}

export async function getFinalPaidDocumentIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ documentId: payments.documentId })
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.type, 'final')));
  return rows.map(r => r.documentId);
}

export async function getMonthlySalesData(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return { payments: [], hktbInvoices: [], finalPayments: [], cashReceiptTotal: 0, cashReceiptCount: 0 };
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${year}-${mm}-01`;
  const endDate = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
  const revenueMonth = `${year}-${mm}`;

  const paymentRows = await db
    .select({ id: payments.id, documentId: payments.documentId, documentTitle: documents.title, clientName: documents.clientName, type: payments.type, amount: payments.amount, paymentDate: payments.paymentDate, totalAmount: documents.totalMax, cashReceiptIssued: payments.cashReceiptIssued, cashReceiptDate: payments.cashReceiptDate, memo: payments.memo })
    .from(payments)
    .innerJoin(documents, eq(payments.documentId, documents.id))
    .where(and(eq(payments.userId, userId), gte(payments.paymentDate, startDate), lte(payments.paymentDate, endDate)))
    .orderBy(desc(payments.paymentDate));

  const hktbRows = await db
    .select()
    .from(hktbInvoices)
    .where(and(eq(hktbInvoices.userId, userId), eq(hktbInvoices.revenueMonth, revenueMonth)));

  const startDateDot = `${year}.${mm}.01`;
  const endDateDot = `${year}.${mm}.${String(lastDay).padStart(2, "0")}`;

  const finalPaymentRowsRaw = await db
    .select({
      id: clients.id,
      name: clients.name,
      contactName: clients.contactName,
      contractAmount: clients.contractAmount,
      finalPaymentDate: clients.finalPaymentDate,
      finalPaymentAmount: clients.finalPaymentAmount,
      cashReceiptIssued: clients.cashReceiptIssued,
      cashReceiptDate: clients.cashReceiptDate,
      memo: clients.finalPaymentMemo,
    })
    .from(clients)
    .where(
      and(
        eq(clients.userId, userId),
        eq(clients.status, '완료'),
        gte(clients.finalPaymentDate, startDateDot),
        lte(clients.finalPaymentDate, endDateDot)
      )
    );

  // 같은 고객사의 견적서에 payments 테이블상 잔금 기록이 (시기 무관하게) 이미 있으면, clients.finalPaymentDate/Amount는
  // 그 기록을 그대로 미러링한 값이므로 일반 매출 내역·현금영수증 집계와 중복되지 않도록 항상 제외
  const allFinalPaymentClientNames = await db
    .select({ clientName: documents.clientName })
    .from(payments)
    .innerJoin(documents, eq(payments.documentId, documents.id))
    .where(and(eq(payments.userId, userId), eq(payments.type, 'final')));
  const finalPaidClientNames = new Set(allFinalPaymentClientNames.map((r) => r.clientName));
  const finalPaymentRows = finalPaymentRowsRaw.filter((c) => !finalPaidClientNames.has(c.name));

  // 현금영수증 발급분은 결제일이 아니라 "현금영수증 발급일" 기준으로 집계 (실제 발급일이 결제월과 다를 수 있음)
  const cashReceiptPaymentRows = await db
    .select({ amount: payments.amount })
    .from(payments)
    .where(and(
      eq(payments.userId, userId),
      eq(payments.cashReceiptIssued, true),
      gte(payments.cashReceiptDate, startDate),
      lte(payments.cashReceiptDate, endDate),
    ));

  const cashReceiptHktbRows = await db
    .select({ totalAmount: hktbInvoices.totalAmount })
    .from(hktbInvoices)
    .where(and(
      eq(hktbInvoices.userId, userId),
      eq(hktbInvoices.cashReceiptIssued, true),
      gte(hktbInvoices.cashReceiptDate, startDate),
      lte(hktbInvoices.cashReceiptDate, endDate),
    ));

  const cashReceiptFinalRowsRaw = await db
    .select({ name: clients.name, finalPaymentAmount: clients.finalPaymentAmount, contractAmount: clients.contractAmount })
    .from(clients)
    .where(and(
      eq(clients.userId, userId),
      eq(clients.cashReceiptIssued, true),
      gte(clients.cashReceiptDate, startDate),
      lte(clients.cashReceiptDate, endDate),
    ));
  // 잔금 수령 목록과 동일하게, payments 테이블에 이미 잡힌 고객사는 현금영수증 합계에서도 중복 제외
  const cashReceiptFinalRows = cashReceiptFinalRowsRaw.filter((c) => !finalPaidClientNames.has(c.name));

  const cashReceiptTotal =
    cashReceiptPaymentRows.reduce((s, p) => s + p.amount, 0) +
    cashReceiptHktbRows.reduce((s, h) => s + h.totalAmount, 0) +
    cashReceiptFinalRows.reduce((s, f) => s + (f.finalPaymentAmount ?? f.contractAmount ?? 0), 0);
  const cashReceiptCount = cashReceiptPaymentRows.length + cashReceiptHktbRows.length + cashReceiptFinalRows.length;

  return {
    payments: paymentRows,
    hktbInvoices: hktbRows,
    finalPayments: finalPaymentRows,
    cashReceiptTotal,
    cashReceiptCount,
  };
}

export async function updatePaymentCashReceipt(id: number, userId: number, issued: boolean, date: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(payments).set({ cashReceiptIssued: issued, cashReceiptDate: date }).where(and(eq(payments.id, id), eq(payments.userId, userId)));
}

export async function updateHktbCashReceipt(id: number, userId: number, issued: boolean, date: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(hktbInvoices).set({ cashReceiptIssued: issued, cashReceiptDate: date }).where(and(eq(hktbInvoices.id, id), eq(hktbInvoices.userId, userId)));
}

export async function updateClientCashReceipt(id: number, userId: number, issued: boolean, date: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set({ cashReceiptIssued: issued, cashReceiptDate: date }).where(and(eq(clients.id, id), eq(clients.userId, userId)));
}

export async function updatePaymentMemo(id: number, userId: number, memo: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(payments).set({ memo }).where(and(eq(payments.id, id), eq(payments.userId, userId)));
}

export async function updateHktbMemo(id: number, userId: number, memo: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(hktbInvoices).set({ memo }).where(and(eq(hktbInvoices.id, id), eq(hktbInvoices.userId, userId)));
}

export async function updateFinalPaymentMemo(id: number, userId: number, memo: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set({ finalPaymentMemo: memo }).where(and(eq(clients.id, id), eq(clients.userId, userId)));
}

// ─── Dashboard ───────────────────────────────────────────────────

export async function getDashboardData(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

  // 이번 달 계약 건수/금액: clients.contractDate 기준, status가 계약 또는 완료인 고객
  const allClients = await db.select({
    id: clients.id,
    name: clients.name,
    status: clients.status,
    contractDate: clients.contractDate,
    contractAmount: clients.contractAmount,
    linkedEstimateId: clients.linkedEstimateId,
  }).from(clients).where(eq(clients.userId, userId));

  // contractDate는 "2026.06.08" 또는 "2026-06-08" 혼용 → 비교 전 하이픈으로 통일
  const normDate = (d: string) => (d || '').replace(/\./g, '-');

  // 진행중 계약 (status='계약') 전체
  const activeContractClients = allClients.filter(c => c.status === '계약');
  const thisMonthContractCount = activeContractClients.length;
  const thisMonthContractAmount = activeContractClients.reduce((s, c) => s + (c.contractAmount || 0), 0);
  const contractClientsList = activeContractClients.map(c => ({ id: c.id, name: c.name, contractAmount: c.contractAmount || 0 }));

  // 상담 중 고객: 계약·완료 제외
  const consultingClientsList = allClients
    .filter(c => c.status === '상담' || c.status === '제안서')
    .map(c => ({ id: c.id, name: c.name, status: c.status }));
  const consultingCount = consultingClientsList.length;

  // 미수금: 계약 상태 고객들의 계약금 합산 - 그 고객들이 실제로 입금한 금액만 합산 (다른 완료 건 입금액이 섞이면 안 됨)
  const contractClients = allClients.filter(c => c.status === '계약');
  const totalContractAmount = contractClients.reduce((s, c) => s + (c.contractAmount || 0), 0);
  const contractClientNames = new Set(contractClients.map(c => c.name));

  const allPaymentsWithClient = await db
    .select({ amount: payments.amount, clientName: documents.clientName })
    .from(payments)
    .innerJoin(documents, eq(payments.documentId, documents.id))
    .where(eq(payments.userId, userId));

  const paidByClientName = new Map<string, number>();
  for (const p of allPaymentsWithClient) {
    if (!p.clientName) continue;
    paidByClientName.set(p.clientName, (paidByClientName.get(p.clientName) ?? 0) + p.amount);
  }

  const totalPaid = allPaymentsWithClient
    .filter(p => contractClientNames.has(p.clientName))
    .reduce((s, p) => s + p.amount, 0);
  const unpaidAmount = Math.max(0, totalContractAmount - totalPaid);

  const unpaidBreakdown = contractClients
    .map(c => {
      const paidAmount = paidByClientName.get(c.name) ?? 0;
      const clientUnpaid = Math.max(0, (c.contractAmount || 0) - paidAmount);
      return { id: c.id, name: c.name, contractAmount: c.contractAmount || 0, paidAmount, unpaidAmount: clientUnpaid };
    })
    .filter(c => c.unpaidAmount > 0);

  // 최근 문서 10개 (같은 고객사는 가장 최근 것만)
  const recentDocsRaw = await db.select({
    id: documents.id, type: documents.type, title: documents.title,
    clientName: documents.clientName, date: documents.date,
    totalMin: documents.totalMin, totalMax: documents.totalMax,
    updatedAt: documents.updatedAt,
  }).from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.updatedAt))
    .limit(50);

  const seenClientNames = new Set<string>();
  const recentDocs = [];
  for (const doc of recentDocsRaw) {
    if (doc.clientName) {
      if (seenClientNames.has(doc.clientName)) continue;
      seenClientNames.add(doc.clientName);
    }
    recentDocs.push(doc);
    if (recentDocs.length >= 10) break;
  }

  // 최근 6개월 월별 계약 금액: clients.contractDate + contractAmount 기준
  const months: { year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const contractedClients = allClients.filter(c => c.status === '계약' || c.status === '완료');
  const monthlySummary = months.map(({ year: y, month: m }) => {
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    const amount = contractedClients
      .filter(c => normDate(c.contractDate) >= start && normDate(c.contractDate) <= end)
      .reduce((s, c) => s + (c.contractAmount || 0), 0);
    return { label: `${m}월`, amount };
  });

  // 상담 → 제안서 → 계약 단계별 고객 수
  const statusCounts = { '상담': 0, '제안서': 0, '계약': 0, '완료': 0 };
  allClients.forEach(c => { statusCounts[c.status ?? '상담']++; });

  return {
    thisMonthContractCount,
    thisMonthContractAmount,
    unpaidAmount,
    consultingCount,
    recentDocs,
    monthlySummary,
    clientStatus: [
      { name: '상담', value: statusCounts['상담'] },
      { name: '제안서', value: statusCounts['제안서'] },
      { name: '계약', value: statusCounts['계약'] },
    ],
    contractClientsList,
    consultingClientsList,
    unpaidBreakdown,
  };
}

// ─── Consultations CRUD ──────────────────────────────────────────

export async function listConsultations(clientId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(consultations)
    .where(and(eq(consultations.clientId, clientId), eq(consultations.userId, userId)))
    .orderBy(desc(consultations.date), desc(consultations.createdAt));
}

export async function createConsultation(data: InsertConsultation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(consultations).values(data).returning({ id: consultations.id });
  const result = await db.select().from(consultations).where(eq(consultations.id, inserted.id)).limit(1);
  return result[0];
}

export async function updateConsultation(id: number, userId: number, data: Partial<Omit<InsertConsultation, "id" | "userId" | "clientId" | "createdAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(consultations).set(data).where(and(eq(consultations.id, id), eq(consultations.userId, userId)));
  const result = await db.select().from(consultations).where(eq(consultations.id, id)).limit(1);
  return result[0];
}

export async function deleteConsultation(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(consultations).where(and(eq(consultations.id, id), eq(consultations.userId, userId)));
  return { success: true };
}

// ─── Calendar Events ─────────────────────────────────────────────

export async function getCalendarEvents(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const [allConsultations, allClients, allDocuments] = await Promise.all([
    db.select({
      id: consultations.id,
      date: consultations.date,
      content: consultations.content,
      clientId: consultations.clientId,
    }).from(consultations).where(eq(consultations.userId, userId)),
    db.select({
      id: clients.id,
      name: clients.name,
      contractDate: clients.contractDate,
      pcDraftDate: clients.pcDraftDate,
      mobileDraftDate: clients.mobileDraftDate,
      finalDeliveryDate: clients.finalDeliveryDate,
    }).from(clients).where(eq(clients.userId, userId)),
    db.select({
      id: documents.id,
      type: documents.type,
      date: documents.date,
      clientName: documents.clientName,
      projectName: documents.projectName,
    }).from(documents).where(eq(documents.userId, userId)),
  ]);

  const clientMap = new Map(allClients.map((c) => [c.id, c.name]));

  // 날짜가 "2026.01.15"(점) / "2026-01-15"(대시) 형식이 혼용되어 저장되므로 대시 형식으로 통일
  const normDate = (d: string) => d.replace(/\./g, "-");

  const events: { date: string; type: string; label: string; id: string; clientId?: number }[] = [];

  for (const c of allConsultations) {
    if (c.date) {
      events.push({ date: normDate(c.date), type: 'consultation', label: clientMap.get(c.clientId) || '고객사', id: `consultation-${c.id}`, clientId: c.clientId });
    }
  }

  for (const cl of allClients) {
    if (cl.contractDate) {
      events.push({ date: normDate(cl.contractDate), type: 'contract', label: cl.name, id: `contract-${cl.id}`, clientId: cl.id });
    }
    if (cl.pcDraftDate) {
      events.push({ date: normDate(cl.pcDraftDate), type: 'pcDraft', label: cl.name, id: `pcDraft-${cl.id}`, clientId: cl.id });
    }
    if (cl.mobileDraftDate) {
      events.push({ date: normDate(cl.mobileDraftDate), type: 'mobileDraft', label: cl.name, id: `mobileDraft-${cl.id}`, clientId: cl.id });
    }
    if (cl.finalDeliveryDate) {
      events.push({ date: normDate(cl.finalDeliveryDate), type: 'finalDelivery', label: cl.name, id: `finalDelivery-${cl.id}`, clientId: cl.id });
    }
  }

  for (const doc of allDocuments) {
    if (doc.date) {
      events.push({ date: normDate(doc.date), type: doc.type, label: doc.clientName || doc.projectName || '문서', id: `doc-${doc.id}` });
    }
  }

  return events;
}

export async function getWorkRanges(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: clients.id,
    name: clients.name,
    workStartDate: clients.workStartDate,
    finalDeliveryDate: clients.finalDeliveryDate,
  }).from(clients).where(eq(clients.userId, userId));

  return rows
    .filter((c) => c.workStartDate)
    .map((c) => ({
      clientId: c.id,
      clientName: c.name,
      startDate: c.workStartDate,
      endDate: c.finalDeliveryDate || '',
    }));
}

// ─── Service Items CRUD ───────────────────────────────────────────

export async function listServiceItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(serviceItems).where(eq(serviceItems.userId, userId)).orderBy(asc(serviceItems.sortOrder), asc(serviceItems.category), asc(serviceItems.createdAt));
}

export async function createServiceItem(data: InsertServiceItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(serviceItems).values(data).returning({ id: serviceItems.id });
  const result = await db.select().from(serviceItems).where(eq(serviceItems.id, inserted.id)).limit(1);
  return result[0];
}

export async function updateServiceItem(id: number, userId: number, data: Partial<Omit<InsertServiceItem, "id" | "userId" | "createdAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(serviceItems).set(data).where(and(eq(serviceItems.id, id), eq(serviceItems.userId, userId)));
  const result = await db.select().from(serviceItems).where(eq(serviceItems.id, id)).limit(1);
  return result[0];
}

export async function deleteServiceItem(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(serviceItems).where(and(eq(serviceItems.id, id), eq(serviceItems.userId, userId)));
  return { success: true };
}

// ─── Kanban ──────────────────────────────────────────────────────

export async function getKanbanClients(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: clients.id,
    name: clients.name,
    contactName: clients.contactName,
    contractAmount: clients.contractAmount,
    workflowStatus: clients.workflowStatus,
    workflowCompletedAt: clients.workflowCompletedAt,
    status: clients.status,
  }).from(clients)
    .where(and(eq(clients.userId, userId), ne(clients.workflowStatus, '상담')))
    .orderBy(asc(clients.name));
}

// 계약금 확정 시: 연결된 고객 status → '계약', workflowStatus → '진행대기'
export async function confirmDepositForClient(documentId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  const doc = await db.select({ clientName: documents.clientName, date: documents.date, totalMax: documents.totalMax }).from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId))).limit(1);
  const clientName = doc[0]?.clientName;
  if (!clientName) return;
  await db.update(clients)
    .set({
      status: '계약',
      workflowStatus: '진행대기',
      contractDate: doc[0].date.replace(/\./g, '-'),
      contractAmount: doc[0].totalMax,
    })
    .where(and(
      eq(clients.userId, userId),
      eq(clients.name, clientName),
      eq(clients.workflowStatus, '상담'),
    ));
}

// 잔금 확정 시: 연결된 고객 status → '완료', workflowStatus → '완료', 잔금 수령일/금액 기록
// 고객사명으로 매칭하므로 한 고객사에 견적서가 여러 건 있어도 어느 것을 확정하든 정상 반영됨
export async function confirmFinalPaymentForClient(documentId: number, userId: number, paymentDate: string, amount: number) {
  const db = await getDb();
  if (!db) return;
  const doc = await db.select({ clientName: documents.clientName }).from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId))).limit(1);
  const clientName = doc[0]?.clientName;
  if (!clientName) return;
  await db.update(clients)
    .set({
      status: '완료',
      workflowStatus: '완료',
      workflowCompletedAt: new Date(),
      finalPaymentDate: paymentDate.replace(/-/g, '.'),
      finalPaymentAmount: amount,
    })
    .where(and(
      eq(clients.userId, userId),
      eq(clients.name, clientName),
    ));
}

export async function updateClientWorkflowStatus(id: number, userId: number, workflowStatus: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const extra = workflowStatus === '완료'
    ? { workflowCompletedAt: new Date() }
    : { workflowCompletedAt: null };
  await db.update(clients).set({ workflowStatus: workflowStatus as any, ...extra }).where(and(eq(clients.id, id), eq(clients.userId, userId)));
  return { success: true };
}

// ─── Clients CRUD ────────────────────────────────────────────────

export async function listClients(userId: number, search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    const { ilike } = await import("drizzle-orm");
    const pattern = `%${search}%`;
    const digitsPattern = `%${search.replace(/-/g, "")}%`;
    return db.select().from(clients)
      .where(and(
        eq(clients.userId, userId),
        or(
          ilike(clients.name, pattern),
          sql`replace(${clients.contactPhone}, '-', '') ILIKE ${digitsPattern}`,
          ilike(clients.contactName, pattern),
          sql`replace(${clients.businessNumber}, '-', '') ILIKE ${digitsPattern}`,
        ),
      ))
      .orderBy(desc(clients.createdAt));
  }
  return db.select().from(clients).where(eq(clients.userId, userId)).orderBy(desc(clients.createdAt));
}

export async function getClient(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.userId, userId))).limit(1);
  return result[0];
}

// 어디서 들어오든(자동 생성, 수동 입력, 문서 동기화) 연락처는 항상 하이픈 포맷으로 저장되도록 통일
function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.contactPhone) data.contactPhone = normalizePhone(data.contactPhone);
  const [inserted] = await db.insert(clients).values(data).returning({ id: clients.id });
  const result = await db.select().from(clients).where(eq(clients.id, inserted.id)).limit(1);
  return result[0];
}

export async function updateClient(id: number, userId: number, data: Partial<Omit<InsertClient, "id" | "userId" | "createdAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.contactPhone) data.contactPhone = normalizePhone(data.contactPhone);
  await db.update(clients).set(data).where(and(eq(clients.id, id), eq(clients.userId, userId)));
  // 상태가 '계약'으로 처음 바뀌면 진행현황도 '진행대기'로 함께 시작
  if (data.status === '계약' && data.workflowStatus === undefined) {
    await db.update(clients)
      .set({ workflowStatus: '진행대기' })
      .where(and(eq(clients.id, id), eq(clients.userId, userId), eq(clients.workflowStatus, '상담')));
  }
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}

export async function deleteClient(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(clients).where(and(eq(clients.id, id), eq(clients.userId, userId)));
  return { success: true };
}

const STATUS_RANK: Record<string, number> = { '상담': 0, '제안서': 1, '계약': 2 };

export async function upsertClientFromDocument(
  userId: number,
  data: { name: string; contactName: string; contactPhone: string; isEstimate: boolean; contractDate?: string; contractAmount?: number }
) {
  const db = await getDb();
  if (!db) return;
  if (!data.name.trim()) return;

  const newStatus = data.isEstimate ? '계약' : '제안서';

  const existing = await db.select().from(clients)
    .where(and(eq(clients.userId, userId), eq(clients.name, data.name)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(clients).values({
      userId,
      name: data.name,
      contactName: data.contactName || '',
      contactPhone: data.contactPhone ? normalizePhone(data.contactPhone) : '',
      businessNumber: '',
      contractDate: data.contractDate || '',
      contractAmount: data.contractAmount || 0,
      status: newStatus as "상담" | "제안서" | "계약",
      memo: '',
    });
  } else {
    const client = existing[0];
    const updates: Partial<typeof clients.$inferInsert> = {};
    if (!client.contactName && data.contactName) updates.contactName = data.contactName;
    if (!client.contactPhone && data.contactPhone) updates.contactPhone = normalizePhone(data.contactPhone);
    if (data.contractDate && !client.contractDate) updates.contractDate = data.contractDate;
    if (data.contractAmount && !client.contractAmount) updates.contractAmount = data.contractAmount;
    // 상태는 앞으로만 진행 (상담→제안서→계약, 역방향 불가)
    if (STATUS_RANK[newStatus] > STATUS_RANK[client.status ?? '상담']) {
      updates.status = newStatus as "상담" | "제안서" | "계약";
    }
    if (Object.keys(updates).length > 0) {
      await db.update(clients).set(updates).where(eq(clients.id, client.id));
    }
  }
}

export async function getEstimatesByClientName(clientName: string, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: documents.id,
    title: documents.title,
    date: documents.date,
    totalMin: documents.totalMin,
    totalMax: documents.totalMax,
    memo: documents.memo,
    updatedAt: documents.updatedAt,
  }).from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.type, 'estimate'), eq(documents.clientName, clientName)))
    .orderBy(desc(documents.updatedAt));
}

export async function getProposalsByClientName(clientName: string, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: documents.id,
    title: documents.title,
    projectName: documents.projectName,
    date: documents.date,
    totalMin: documents.totalMin,
    totalMax: documents.totalMax,
    memo: documents.memo,
    updatedAt: documents.updatedAt,
  }).from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.type, 'proposal'), eq(documents.clientName, clientName)))
    .orderBy(desc(documents.updatedAt));
}

async function getPaymentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── HKTB Invoices CRUD ──────────────────────────────────────────

export async function listHktbInvoices(userId: number, type?: "translation" | "retainer") {
  const db = await getDb();
  if (!db) return [];
  const condition = type
    ? and(eq(hktbInvoices.userId, userId), eq(hktbInvoices.type, type))
    : eq(hktbInvoices.userId, userId);
  return db.select().from(hktbInvoices).where(condition).orderBy(desc(hktbInvoices.updatedAt));
}

export async function createHktbInvoice(data: InsertHktbInvoice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(hktbInvoices).values(data).returning({ id: hktbInvoices.id });
  const result = await db.select().from(hktbInvoices).where(eq(hktbInvoices.id, inserted.id)).limit(1);
  return result[0];
}

export async function updateHktbInvoice(id: number, userId: number, data: Partial<Omit<InsertHktbInvoice, "id" | "userId" | "createdAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(hktbInvoices).set(data).where(and(eq(hktbInvoices.id, id), eq(hktbInvoices.userId, userId)));
  const result = await db.select().from(hktbInvoices).where(eq(hktbInvoices.id, id)).limit(1);
  return result[0];
}

export async function deleteHktbInvoice(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(hktbInvoices).where(and(eq(hktbInvoices.id, id), eq(hktbInvoices.userId, userId)));
  return { success: true };
}

// ─── PDF Files ───────────────────────────────────────────────────

export async function listPdfFiles(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: pdfFiles.id, name: pdfFiles.name, fileSize: pdfFiles.fileSize, mimeType: pdfFiles.mimeType, createdAt: pdfFiles.createdAt })
    .from(pdfFiles).where(and(eq(pdfFiles.userId, userId), isNull(pdfFiles.clientId))).orderBy(desc(pdfFiles.createdAt));
}

export async function listPdfFilesByClient(clientId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: pdfFiles.id, name: pdfFiles.name, fileSize: pdfFiles.fileSize, mimeType: pdfFiles.mimeType, createdAt: pdfFiles.createdAt })
    .from(pdfFiles).where(and(eq(pdfFiles.userId, userId), eq(pdfFiles.clientId, clientId))).orderBy(desc(pdfFiles.createdAt));
}

export async function uploadPdfFile(userId: number, name: string, fileSize: number, data: string, clientId?: number, mimeType?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(pdfFiles).values({ userId, name, fileSize, data, clientId: clientId ?? null, mimeType: mimeType || 'application/pdf' }).returning({ id: pdfFiles.id });
  return result[0];
}

export async function getPdfFile(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(pdfFiles).where(and(eq(pdfFiles.id, id), eq(pdfFiles.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function deletePdfFile(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(pdfFiles).where(and(eq(pdfFiles.id, id), eq(pdfFiles.userId, userId)));
  return { success: true };
}
