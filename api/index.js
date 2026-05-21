// server/vercel-handler.ts
import "dotenv/config";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";

// server/_core/env.ts
var ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/_core/notification.ts
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// shared/const.ts
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { z as z2 } from "zod";

// server/db.ts
import { eq, and, desc, asc, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// drizzle/schema.ts
import { integer, json, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
var roleEnum = pgEnum("role", ["user", "admin"]);
var documentTypeEnum = pgEnum("document_type", ["proposal", "estimate"]);
var notesModeEnum = pgEnum("notes_mode", ["list", "freeform"]);
var paymentTypeEnum = pgEnum("payment_type", ["deposit", "final"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date()),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: documentTypeEnum("type").notNull(),
  title: varchar("title", { length: 500 }).default("").notNull(),
  memo: text("memo"),
  clientName: varchar("clientName", { length: 500 }).default("").notNull(),
  contactName: varchar("contactName", { length: 500 }).default("").notNull(),
  projectName: varchar("projectName", { length: 500 }).default("").notNull(),
  platform: varchar("platform", { length: 200 }).default("").notNull(),
  date: varchar("date", { length: 20 }).default("").notNull(),
  items: json("items").$type().notNull(),
  notes: json("notes").$type().notNull(),
  notesMode: notesModeEnum("notesMode").default("list").notNull(),
  freeformNotes: text("freeformNotes"),
  templateVariables: json("templateVariables").$type(),
  totalMin: integer("totalMin").default(0).notNull(),
  totalMax: integer("totalMax").default(0).notNull(),
  contactPhone: varchar("contactPhone", { length: 50 }).default("").notNull(),
  businessType: varchar("businessType", { length: 100 }).default("").notNull(),
  optionalItems: json("optionalItems").$type().default([]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
});
var noteTemplates = pgTable("note_templates", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  notes: json("notes").$type().notNull(),
  mode: notesModeEnum("mode").default("list").notNull(),
  freeformNotes: text("freeformNotes"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
});
var payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  documentId: integer("documentId").notNull(),
  type: paymentTypeEnum("type").notNull(),
  amount: integer("amount").notNull(),
  paymentDate: varchar("paymentDate", { length: 20 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
});
var clientStatusEnum = pgEnum("client_status", ["\uC0C1\uB2F4", "\uC81C\uC548\uC11C", "\uACC4\uC57D"]);
var clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  contactName: varchar("contactName", { length: 200 }).default("").notNull(),
  contactPhone: varchar("contactPhone", { length: 50 }).default("").notNull(),
  businessNumber: varchar("businessNumber", { length: 50 }).default("").notNull(),
  contractDate: varchar("contractDate", { length: 20 }).default("").notNull(),
  contractAmount: integer("contractAmount").default(0).notNull(),
  status: clientStatusEnum("status").default("\uC0C1\uB2F4").notNull(),
  memo: text("memo").default("").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
});
var consultations = pgTable("consultations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  clientId: integer("clientId").notNull(),
  date: varchar("date", { length: 20 }).notNull(),
  content: text("content").notNull(),
  nextAction: text("nextAction").default("").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
});
var serviceItems = pgTable("service_items", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description").default("").notNull(),
  unitPrice: varchar("unitPrice", { length: 50 }).default("").notNull(),
  category: varchar("category", { length: 100 }).default("").notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
});

// server/db.ts
var _db = null;
async function getDb() {
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
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values = { openId: user.openId };
  const updateSet = {};
  const textFields = ["name", "email", "loginMethod"];
  textFields.forEach((field) => {
    if (user[field] === void 0) return;
    values[field] = user[field] ?? null;
    updateSet[field] = user[field] ?? null;
  });
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  }
  if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function listDocuments(userId, type) {
  const db = await getDb();
  if (!db) return [];
  const conditions = type ? and(eq(documents.userId, userId), eq(documents.type, type)) : eq(documents.userId, userId);
  return db.select().from(documents).where(conditions).orderBy(desc(documents.updatedAt));
}
async function getDocument(id, userId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.userId, userId))).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createDocument(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(documents).values(data).returning({ id: documents.id });
  return getDocumentById(inserted.id);
}
async function updateDocument(id, userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(documents).set(data).where(and(eq(documents.id, id), eq(documents.userId, userId)));
  return getDocument(id, userId);
}
async function deleteDocument(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
  return { success: true };
}
async function getDocumentById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function listNoteTemplates(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(noteTemplates).where(eq(noteTemplates.userId, userId)).orderBy(asc(noteTemplates.sortOrder), desc(noteTemplates.createdAt));
}
async function getNoteTemplate(id, userId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(noteTemplates).where(and(eq(noteTemplates.id, id), eq(noteTemplates.userId, userId))).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createNoteTemplate(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(noteTemplates).values(data).returning({ id: noteTemplates.id });
  return getNoteTemplateById(inserted.id);
}
async function updateNoteTemplate(id, userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(noteTemplates).set(data).where(and(eq(noteTemplates.id, id), eq(noteTemplates.userId, userId)));
  return getNoteTemplate(id, userId);
}
async function deleteNoteTemplate(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(noteTemplates).where(and(eq(noteTemplates.id, id), eq(noteTemplates.userId, userId)));
  return { success: true };
}
async function getNoteTemplateById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(noteTemplates).where(eq(noteTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createPayment(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(payments).values(data).returning({ id: payments.id });
  return getPaymentById(inserted.id);
}
async function getDocumentPayments(documentId, userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(and(eq(payments.documentId, documentId), eq(payments.userId, userId))).orderBy(desc(payments.paymentDate));
}
async function getMonthlySalesData(userId, year, month) {
  const db = await getDb();
  if (!db) return [];
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];
  return db.select({ documentId: payments.documentId, documentTitle: documents.title, clientName: documents.clientName, type: payments.type, amount: payments.amount, paymentDate: payments.paymentDate, totalAmount: documents.totalMax }).from(payments).innerJoin(documents, eq(payments.documentId, documents.id)).where(and(eq(payments.userId, userId), gte(payments.paymentDate, startDate), lte(payments.paymentDate, endDate))).orderBy(desc(payments.paymentDate));
}
async function getDashboardData(userId) {
  const db = await getDb();
  if (!db) return null;
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = new Date(year, month, 0).toISOString().split("T")[0];
  const thisMonthDocs = await db.select({
    id: documents.id,
    type: documents.type,
    title: documents.title,
    clientName: documents.clientName,
    date: documents.date,
    totalMin: documents.totalMin,
    totalMax: documents.totalMax,
    updatedAt: documents.updatedAt
  }).from(documents).where(and(eq(documents.userId, userId), eq(documents.type, "estimate"), gte(documents.date, monthStart), lte(documents.date, monthEnd)));
  const thisMonthContractCount = thisMonthDocs.length;
  const thisMonthContractAmount = thisMonthDocs.reduce((s, d) => s + (d.totalMin || 0), 0);
  const allPayments = await db.select({ amount: payments.amount, documentId: payments.documentId }).from(payments).where(eq(payments.userId, userId));
  const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);
  const allEstimates = await db.select({ totalMin: documents.totalMin }).from(documents).where(and(eq(documents.userId, userId), eq(documents.type, "estimate")));
  const totalContractAmount = allEstimates.reduce((s, d) => s + (d.totalMin || 0), 0);
  const unpaidAmount = totalContractAmount - totalPaid;
  const consultingClients = await db.select({ id: clients.id, status: clients.status }).from(clients).where(eq(clients.userId, userId));
  const consultingCount = consultingClients.filter((c) => c.status !== "\uACC4\uC57D").length;
  const recentDocs = await db.select({
    id: documents.id,
    type: documents.type,
    title: documents.title,
    clientName: documents.clientName,
    date: documents.date,
    totalMin: documents.totalMin,
    totalMax: documents.totalMax,
    updatedAt: documents.updatedAt
  }).from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.updatedAt)).limit(10);
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  const monthlySummary = await Promise.all(months.map(async ({ year: y, month: m }) => {
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const end = new Date(y, m, 0).toISOString().split("T")[0];
    const rows = await db.select({ totalMin: documents.totalMin }).from(documents).where(and(eq(documents.userId, userId), eq(documents.type, "estimate"), gte(documents.date, start), lte(documents.date, end)));
    return { label: `${m}\uC6D4`, amount: rows.reduce((s, r) => s + (r.totalMin || 0), 0) };
  }));
  const allClients = await db.select({ status: clients.status }).from(clients).where(eq(clients.userId, userId));
  const statusCounts = { "\uC0C1\uB2F4": 0, "\uC81C\uC548\uC11C": 0, "\uACC4\uC57D": 0 };
  allClients.forEach((c) => {
    statusCounts[c.status ?? "\uC0C1\uB2F4"]++;
  });
  return {
    thisMonthContractCount,
    thisMonthContractAmount,
    unpaidAmount,
    consultingCount,
    recentDocs,
    monthlySummary,
    clientStatus: [
      { name: "\uC0C1\uB2F4", value: statusCounts["\uC0C1\uB2F4"] },
      { name: "\uC81C\uC548\uC11C", value: statusCounts["\uC81C\uC548\uC11C"] },
      { name: "\uACC4\uC57D", value: statusCounts["\uACC4\uC57D"] }
    ]
  };
}
async function listConsultations(clientId, userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(consultations).where(and(eq(consultations.clientId, clientId), eq(consultations.userId, userId))).orderBy(desc(consultations.date), desc(consultations.createdAt));
}
async function createConsultation(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(consultations).values(data).returning({ id: consultations.id });
  const result = await db.select().from(consultations).where(eq(consultations.id, inserted.id)).limit(1);
  return result[0];
}
async function updateConsultation(id, userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(consultations).set(data).where(and(eq(consultations.id, id), eq(consultations.userId, userId)));
  const result = await db.select().from(consultations).where(eq(consultations.id, id)).limit(1);
  return result[0];
}
async function deleteConsultation(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(consultations).where(and(eq(consultations.id, id), eq(consultations.userId, userId)));
  return { success: true };
}
async function listServiceItems(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(serviceItems).where(eq(serviceItems.userId, userId)).orderBy(asc(serviceItems.sortOrder), asc(serviceItems.category), asc(serviceItems.createdAt));
}
async function createServiceItem(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(serviceItems).values(data).returning({ id: serviceItems.id });
  const result = await db.select().from(serviceItems).where(eq(serviceItems.id, inserted.id)).limit(1);
  return result[0];
}
async function updateServiceItem(id, userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(serviceItems).set(data).where(and(eq(serviceItems.id, id), eq(serviceItems.userId, userId)));
  const result = await db.select().from(serviceItems).where(eq(serviceItems.id, id)).limit(1);
  return result[0];
}
async function deleteServiceItem(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(serviceItems).where(and(eq(serviceItems.id, id), eq(serviceItems.userId, userId)));
  return { success: true };
}
async function listClients(userId, search) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    const { ilike, or } = await import("drizzle-orm");
    const pattern = `%${search}%`;
    return db.select().from(clients).where(and(eq(clients.userId, userId), or(ilike(clients.name, pattern), ilike(clients.contactPhone, pattern), ilike(clients.contactName, pattern)))).orderBy(asc(clients.name));
  }
  return db.select().from(clients).where(eq(clients.userId, userId)).orderBy(asc(clients.name));
}
async function getClient(id, userId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.userId, userId))).limit(1);
  return result[0];
}
async function createClient(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(clients).values(data).returning({ id: clients.id });
  const result = await db.select().from(clients).where(eq(clients.id, inserted.id)).limit(1);
  return result[0];
}
async function updateClient(id, userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clients).set(data).where(and(eq(clients.id, id), eq(clients.userId, userId)));
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result[0];
}
async function deleteClient(id, userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(clients).where(and(eq(clients.id, id), eq(clients.userId, userId)));
  return { success: true };
}
var STATUS_RANK = { "\uC0C1\uB2F4": 0, "\uC81C\uC548\uC11C": 1, "\uACC4\uC57D": 2 };
async function upsertClientFromDocument(userId, data) {
  const db = await getDb();
  if (!db) return;
  if (!data.name.trim()) return;
  const newStatus = data.isEstimate ? "\uACC4\uC57D" : "\uC81C\uC548\uC11C";
  const existing = await db.select().from(clients).where(and(eq(clients.userId, userId), eq(clients.name, data.name))).limit(1);
  if (existing.length === 0) {
    await db.insert(clients).values({
      userId,
      name: data.name,
      contactName: data.contactName || "",
      contactPhone: data.contactPhone || "",
      businessNumber: "",
      contractDate: data.contractDate || "",
      contractAmount: data.contractAmount || 0,
      status: newStatus,
      memo: ""
    });
  } else {
    const client = existing[0];
    const updates = {};
    if (!client.contactName && data.contactName) updates.contactName = data.contactName;
    if (!client.contactPhone && data.contactPhone) updates.contactPhone = data.contactPhone;
    if (data.contractDate && !client.contractDate) updates.contractDate = data.contractDate;
    if (data.contractAmount && !client.contractAmount) updates.contractAmount = data.contractAmount;
    if (STATUS_RANK[newStatus] > STATUS_RANK[client.status ?? "\uC0C1\uB2F4"]) {
      updates.status = newStatus;
    }
    if (Object.keys(updates).length > 0) {
      await db.update(clients).set(updates).where(eq(clients.id, client.id));
    }
  }
}
async function getEstimatesByClientName(clientName, userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: documents.id,
    title: documents.title,
    date: documents.date,
    totalMin: documents.totalMin,
    totalMax: documents.totalMax,
    updatedAt: documents.updatedAt
  }).from(documents).where(and(eq(documents.userId, userId), eq(documents.type, "estimate"), eq(documents.clientName, clientName))).orderBy(desc(documents.updatedAt));
}
async function getPaymentById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}

// server/routers.ts
var documentItemSchema = z2.object({
  id: z2.string(),
  name: z2.string(),
  quantity: z2.string(),
  originalPrice: z2.string(),
  discountPrice: z2.string(),
  discountAmount: z2.string().optional().default(""),
  unitPrice: z2.string().optional().default("")
});
var documentInputSchema = z2.object({
  type: z2.enum(["proposal", "estimate"]),
  title: z2.string().default(""),
  memo: z2.string().nullable().default(null),
  clientName: z2.string().default(""),
  contactName: z2.string().default(""),
  projectName: z2.string().default(""),
  platform: z2.string().default(""),
  date: z2.string().default(""),
  items: z2.array(documentItemSchema),
  notes: z2.array(z2.string()),
  notesMode: z2.enum(["list", "freeform"]).default("list"),
  freeformNotes: z2.string().nullable().default(null),
  templateVariables: z2.record(z2.string(), z2.string()).nullable().default(null),
  totalMin: z2.number().default(0),
  totalMax: z2.number().default(0),
  contactPhone: z2.string().default(""),
  businessType: z2.string().default("")
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(() => {
      return { success: true };
    })
  }),
  noteTemplates: router({
    /** List all note templates for the logged-in user */
    list: protectedProcedure.query(async ({ ctx }) => {
      return listNoteTemplates(ctx.user.id);
    }),
    /** Get a single note template by ID */
    get: protectedProcedure.input(z2.object({ id: z2.number() })).query(async ({ ctx, input }) => {
      const tmpl = await getNoteTemplate(input.id, ctx.user.id);
      if (!tmpl) throw new Error("Template not found");
      return tmpl;
    }),
    /** Create a new note template */
    create: protectedProcedure.input(
      z2.object({
        name: z2.string().min(1),
        notes: z2.array(z2.string()),
        mode: z2.enum(["list", "freeform"]).default("list"),
        freeformNotes: z2.string().nullable().default(null),
        sortOrder: z2.number().default(0)
      })
    ).mutation(async ({ ctx, input }) => {
      return createNoteTemplate({
        userId: ctx.user.id,
        name: input.name,
        notes: input.notes,
        mode: input.mode,
        freeformNotes: input.freeformNotes,
        sortOrder: input.sortOrder
      });
    }),
    /** Update an existing note template */
    update: protectedProcedure.input(
      z2.object({
        id: z2.number(),
        data: z2.object({
          name: z2.string().min(1).optional(),
          notes: z2.array(z2.string()).optional(),
          mode: z2.enum(["list", "freeform"]).optional(),
          freeformNotes: z2.string().nullable().optional(),
          sortOrder: z2.number().optional()
        })
      })
    ).mutation(async ({ ctx, input }) => {
      const updateData = {};
      if (input.data.name !== void 0) updateData.name = input.data.name;
      if (input.data.notes !== void 0) updateData.notes = input.data.notes;
      if (input.data.mode !== void 0) updateData.mode = input.data.mode;
      if (input.data.freeformNotes !== void 0) updateData.freeformNotes = input.data.freeformNotes;
      if (input.data.sortOrder !== void 0) updateData.sortOrder = input.data.sortOrder;
      const tmpl = await updateNoteTemplate(input.id, ctx.user.id, updateData);
      if (!tmpl) throw new Error("Template not found or not authorized");
      return tmpl;
    }),
    /** Delete a note template */
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      return deleteNoteTemplate(input.id, ctx.user.id);
    }),
    /** Save current document notes as a new template */
    saveFromDocument: protectedProcedure.input(
      z2.object({
        name: z2.string().min(1),
        notes: z2.array(z2.string()),
        mode: z2.enum(["list", "freeform"]).default("list"),
        freeformNotes: z2.string().nullable().default(null)
      })
    ).mutation(async ({ ctx, input }) => {
      return createNoteTemplate({
        userId: ctx.user.id,
        name: input.name,
        notes: input.notes,
        mode: input.mode,
        freeformNotes: input.freeformNotes,
        sortOrder: 0
      });
    })
  }),
  documents: router({
    /** List documents for the logged-in user, optionally filtered by type */
    list: protectedProcedure.input(
      z2.object({
        type: z2.enum(["proposal", "estimate"]).optional()
      }).optional()
    ).query(async ({ ctx, input }) => {
      return listDocuments(ctx.user.id, input?.type);
    }),
    /** Get a single document by ID */
    get: protectedProcedure.input(z2.object({ id: z2.number() })).query(async ({ ctx, input }) => {
      const doc = await getDocument(input.id, ctx.user.id);
      if (!doc) {
        throw new Error("Document not found");
      }
      return doc;
    }),
    /** Create a new document */
    create: protectedProcedure.input(documentInputSchema).mutation(async ({ ctx, input }) => {
      const doc = await createDocument({
        userId: ctx.user.id,
        type: input.type,
        title: input.title,
        memo: input.memo,
        clientName: input.clientName,
        contactName: input.contactName,
        projectName: input.projectName,
        platform: input.platform,
        date: input.date,
        items: input.items,
        notes: input.notes,
        notesMode: input.notesMode,
        freeformNotes: input.freeformNotes,
        templateVariables: input.templateVariables,
        totalMin: input.totalMin,
        totalMax: input.totalMax,
        contactPhone: input.contactPhone,
        businessType: input.businessType
      });
      return doc;
    }),
    /** Update an existing document */
    update: protectedProcedure.input(
      z2.object({
        id: z2.number(),
        data: documentInputSchema.partial()
      })
    ).mutation(async ({ ctx, input }) => {
      const updateData = {};
      if (input.data.type !== void 0) updateData.type = input.data.type;
      if (input.data.title !== void 0) updateData.title = input.data.title;
      if (input.data.memo !== void 0) updateData.memo = input.data.memo;
      if (input.data.clientName !== void 0) updateData.clientName = input.data.clientName;
      if (input.data.projectName !== void 0) updateData.projectName = input.data.projectName;
      if (input.data.platform !== void 0) updateData.platform = input.data.platform;
      if (input.data.date !== void 0) updateData.date = input.data.date;
      if (input.data.items !== void 0) updateData.items = input.data.items;
      if (input.data.notes !== void 0) updateData.notes = input.data.notes;
      if (input.data.notesMode !== void 0) updateData.notesMode = input.data.notesMode;
      if (input.data.freeformNotes !== void 0) updateData.freeformNotes = input.data.freeformNotes;
      if (input.data.templateVariables !== void 0) updateData.templateVariables = input.data.templateVariables;
      if (input.data.totalMin !== void 0) updateData.totalMin = input.data.totalMin;
      if (input.data.totalMax !== void 0) updateData.totalMax = input.data.totalMax;
      if (input.data.contactPhone !== void 0) updateData.contactPhone = input.data.contactPhone;
      if (input.data.businessType !== void 0) updateData.businessType = input.data.businessType;
      if (input.data.contactName !== void 0) updateData.contactName = input.data.contactName;
      const doc = await updateDocument(input.id, ctx.user.id, updateData);
      if (!doc) {
        throw new Error("Document not found or not authorized");
      }
      return doc;
    }),
    /** Delete a document */
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      return deleteDocument(input.id, ctx.user.id);
    }),
    /** Duplicate a proposal as an estimate */
    duplicateAsEstimate: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      const proposal = await getDocument(input.id, ctx.user.id);
      if (!proposal) {
        throw new Error("Document not found");
      }
      if (proposal.type !== "proposal") {
        throw new Error("Only proposals can be duplicated as estimates");
      }
      const estimate = await createDocument({
        userId: ctx.user.id,
        type: "estimate",
        title: proposal.title,
        memo: proposal.memo,
        clientName: proposal.clientName,
        projectName: proposal.projectName,
        platform: proposal.platform,
        date: proposal.date,
        items: proposal.items,
        notes: proposal.notes,
        notesMode: proposal.notesMode,
        freeformNotes: proposal.freeformNotes,
        templateVariables: proposal.templateVariables,
        totalMin: proposal.totalMin,
        totalMax: proposal.totalMax
      });
      return estimate;
    }),
    /** Record a payment (계약금 확정) */
    recordPayment: protectedProcedure.input(
      z2.object({
        documentId: z2.number(),
        type: z2.enum(["deposit", "final"]),
        amount: z2.number(),
        paymentDate: z2.string(),
        notes: z2.string().optional()
      })
    ).mutation(async ({ ctx, input }) => {
      const doc = await getDocument(input.documentId, ctx.user.id);
      if (!doc) {
        throw new Error("Document not found or not authorized");
      }
      return createPayment({
        userId: ctx.user.id,
        documentId: input.documentId,
        type: input.type,
        amount: input.amount,
        paymentDate: input.paymentDate,
        notes: input.notes || null
      });
    }),
    /** Get all payments for a document */
    getPayments: protectedProcedure.input(z2.object({ documentId: z2.number() })).query(async ({ ctx, input }) => {
      return getDocumentPayments(input.documentId, ctx.user.id);
    })
  }),
  clients: router({
    list: protectedProcedure.input(z2.object({ search: z2.string().optional() }).optional()).query(async ({ ctx, input }) => {
      return listClients(ctx.user.id, input?.search);
    }),
    get: protectedProcedure.input(z2.object({ id: z2.number() })).query(async ({ ctx, input }) => {
      return getClient(input.id, ctx.user.id);
    }),
    create: protectedProcedure.input(z2.object({
      name: z2.string().min(1),
      contactName: z2.string().default(""),
      contactPhone: z2.string().default(""),
      businessNumber: z2.string().default(""),
      contractDate: z2.string().default(""),
      contractAmount: z2.number().default(0),
      memo: z2.string().default("")
    })).mutation(async ({ ctx, input }) => {
      return createClient({ ...input, userId: ctx.user.id });
    }),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      name: z2.string().min(1).optional(),
      contactName: z2.string().optional(),
      contactPhone: z2.string().optional(),
      businessNumber: z2.string().optional(),
      contractDate: z2.string().optional(),
      contractAmount: z2.number().optional(),
      memo: z2.string().optional(),
      status: z2.enum(["\uC0C1\uB2F4", "\uC81C\uC548\uC11C", "\uACC4\uC57D"]).optional()
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return updateClient(id, ctx.user.id, data);
    }),
    getMatchedEstimates: protectedProcedure.input(z2.object({ clientName: z2.string() })).query(async ({ ctx, input }) => {
      return getEstimatesByClientName(input.clientName, ctx.user.id);
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      return deleteClient(input.id, ctx.user.id);
    }),
    upsertFromDocument: protectedProcedure.input(z2.object({
      name: z2.string(),
      contactName: z2.string().default(""),
      contactPhone: z2.string().default(""),
      isEstimate: z2.boolean().default(false),
      contractDate: z2.string().optional(),
      contractAmount: z2.number().optional()
    })).mutation(async ({ ctx, input }) => {
      return upsertClientFromDocument(ctx.user.id, input);
    })
  }),
  consultations: router({
    list: protectedProcedure.input(z2.object({ clientId: z2.number() })).query(async ({ ctx, input }) => {
      return listConsultations(input.clientId, ctx.user.id);
    }),
    create: protectedProcedure.input(z2.object({
      clientId: z2.number(),
      date: z2.string(),
      content: z2.string().min(1),
      nextAction: z2.string().default("")
    })).mutation(async ({ ctx, input }) => {
      return createConsultation({ ...input, userId: ctx.user.id });
    }),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      date: z2.string().optional(),
      content: z2.string().optional(),
      nextAction: z2.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return updateConsultation(id, ctx.user.id, data);
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      return deleteConsultation(input.id, ctx.user.id);
    })
  }),
  serviceItems: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return listServiceItems(ctx.user.id);
    }),
    create: protectedProcedure.input(z2.object({
      name: z2.string().min(1),
      description: z2.string().default(""),
      unitPrice: z2.string().default(""),
      category: z2.string().default(""),
      sortOrder: z2.number().default(0)
    })).mutation(async ({ ctx, input }) => {
      return createServiceItem({ ...input, userId: ctx.user.id });
    }),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      name: z2.string().min(1).optional(),
      description: z2.string().optional(),
      unitPrice: z2.string().optional(),
      category: z2.string().optional(),
      sortOrder: z2.number().optional()
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return updateServiceItem(id, ctx.user.id, data);
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      return deleteServiceItem(input.id, ctx.user.id);
    })
  }),
  dashboard: router({
    getData: protectedProcedure.query(async ({ ctx }) => {
      return getDashboardData(ctx.user.id);
    })
  }),
  sales: router({
    /** Get monthly sales data */
    getMonthly: protectedProcedure.input(
      z2.object({
        year: z2.number(),
        month: z2.number()
      })
    ).query(async ({ ctx, input }) => {
      return getMonthlySalesData(ctx.user.id, input.year, input.month);
    })
  })
});

// server/_core/supabase.ts
import { createClient as createClient2 } from "@supabase/supabase-js";
var supabaseAdmin = createClient2(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    const authHeader = opts.req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token) {
      const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && supabaseUser) {
        const meta = supabaseUser.user_metadata ?? {};
        const name = meta.full_name ?? meta.name ?? meta.user_name ?? null;
        await upsertUser({
          openId: supabaseUser.id,
          email: supabaseUser.email ?? null,
          name,
          loginMethod: supabaseUser.app_metadata?.provider ?? null,
          lastSignedIn: /* @__PURE__ */ new Date()
        });
        const dbUser = await getUserByOpenId(supabaseUser.id);
        user = dbUser ?? null;
      }
    }
  } catch (error) {
    user = null;
  }
  return { req: opts.req, res: opts.res, user };
}

// server/vercel-handler.ts
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
var vercel_handler_default = app;
export {
  vercel_handler_default as default
};
