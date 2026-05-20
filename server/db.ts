import { eq, and, desc, asc, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { InsertUser, users, documents, InsertDocument, noteTemplates, InsertNoteTemplate, payments } from "../drizzle/schema";
import type { InsertPayment } from "../drizzle/schema";

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
  if (!db) return [];
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];
  return db
    .select({ documentId: payments.documentId, documentTitle: documents.title, clientName: documents.clientName, type: payments.type, amount: payments.amount, paymentDate: payments.paymentDate, totalAmount: documents.totalMax })
    .from(payments)
    .innerJoin(documents, eq(payments.documentId, documents.id))
    .where(and(eq(payments.userId, userId), gte(payments.paymentDate, startDate), lte(payments.paymentDate, endDate)))
    .orderBy(desc(payments.paymentDate));
}

async function getPaymentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
