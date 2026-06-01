import { eq, and, desc, asc, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { InsertUser, users, documents, InsertDocument, noteTemplates, InsertNoteTemplate, payments, serviceItems, clients, consultations, hktbInvoices } from "../drizzle/schema";
import type { InsertPayment, InsertServiceItem, InsertClient, InsertConsultation, InsertHktbInvoice } from "../drizzle/schema";

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

export async function getMonthlySalesData(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return { payments: [], hktbInvoices: [] };
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];
  const revenueMonth = `${year}-${String(month).padStart(2, "0")}`;

  const paymentRows = await db
    .select({ documentId: payments.documentId, documentTitle: documents.title, clientName: documents.clientName, type: payments.type, amount: payments.amount, paymentDate: payments.paymentDate, totalAmount: documents.totalMax })
    .from(payments)
    .innerJoin(documents, eq(payments.documentId, documents.id))
    .where(and(eq(payments.userId, userId), gte(payments.paymentDate, startDate), lte(payments.paymentDate, endDate)))
    .orderBy(desc(payments.paymentDate));

  const hktbRows = await db
    .select()
    .from(hktbInvoices)
    .where(and(eq(hktbInvoices.userId, userId), eq(hktbInvoices.revenueMonth, revenueMonth)));

  return { payments: paymentRows, hktbInvoices: hktbRows };
}

// ─── Dashboard ───────────────────────────────────────────────────

export async function getDashboardData(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = new Date(year, month, 0).toISOString().split('T')[0];

  // 이번 달 계약서 (estimate)
  const thisMonthDocs = await db.select({
    id: documents.id, type: documents.type, title: documents.title,
    clientName: documents.clientName, date: documents.date,
    totalMin: documents.totalMin, totalMax: documents.totalMax,
    updatedAt: documents.updatedAt,
  }).from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.type, 'estimate'), gte(documents.date, monthStart), lte(documents.date, monthEnd)));

  const thisMonthContractCount = thisMonthDocs.length;
  const thisMonthContractAmount = thisMonthDocs.reduce((s, d) => s + (d.totalMin || 0), 0);

  // 총 입금액 (payments)
  const allPayments = await db.select({ amount: payments.amount, documentId: payments.documentId })
    .from(payments).where(eq(payments.userId, userId));
  const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);

  // 전체 계약서 합산
  const allEstimates = await db.select({ totalMin: documents.totalMin })
    .from(documents).where(and(eq(documents.userId, userId), eq(documents.type, 'estimate')));
  const totalContractAmount = allEstimates.reduce((s, d) => s + (d.totalMin || 0), 0);
  const unpaidAmount = totalContractAmount - totalPaid;

  // 상담 중 고객 수 (계약 전 = 상담 + 제안서 단계)
  const consultingClients = await db.select({ id: clients.id, status: clients.status })
    .from(clients).where(eq(clients.userId, userId));
  const consultingCount = consultingClients.filter(c => c.status !== '계약').length;

  // 최근 문서 10개
  const recentDocs = await db.select({
    id: documents.id, type: documents.type, title: documents.title,
    clientName: documents.clientName, date: documents.date,
    totalMin: documents.totalMin, totalMax: documents.totalMax,
    updatedAt: documents.updatedAt,
  }).from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.updatedAt))
    .limit(10);

  // 최근 6개월 월별 계약 금액
  const months: { year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const monthlySummary = await Promise.all(months.map(async ({ year: y, month: m }) => {
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = new Date(y, m, 0).toISOString().split('T')[0];
    const rows = await db.select({ totalMin: documents.totalMin })
      .from(documents)
      .where(and(eq(documents.userId, userId), eq(documents.type, 'estimate'), gte(documents.date, start), lte(documents.date, end)));
    return { label: `${m}월`, amount: rows.reduce((s, r) => s + (r.totalMin || 0), 0) };
  }));

  // 상담 → 제안서 → 계약 단계별 고객 수
  const allClients = await db.select({ status: clients.status }).from(clients).where(eq(clients.userId, userId));
  const statusCounts = { '상담': 0, '제안서': 0, '계약': 0 };
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

// ─── Clients CRUD ────────────────────────────────────────────────

export async function listClients(userId: number, search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    const { ilike, or } = await import("drizzle-orm");
    const pattern = `%${search}%`;
    return db.select().from(clients)
      .where(and(eq(clients.userId, userId), or(ilike(clients.name, pattern), ilike(clients.contactPhone, pattern), ilike(clients.contactName, pattern))))
      .orderBy(asc(clients.name));
  }
  return db.select().from(clients).where(eq(clients.userId, userId)).orderBy(asc(clients.name));
}

export async function getClient(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.userId, userId))).limit(1);
  return result[0];
}

export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(clients).values(data).returning({ id: clients.id });
  const result = await db.select().from(clients).where(eq(clients.id, inserted.id)).limit(1);
  return result[0];
}

export async function updateClient(id: number, userId: number, data: Partial<Omit<InsertClient, "id" | "userId" | "createdAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clients).set(data).where(and(eq(clients.id, id), eq(clients.userId, userId)));
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
      contactPhone: data.contactPhone || '',
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
    if (!client.contactPhone && data.contactPhone) updates.contactPhone = data.contactPhone;
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
