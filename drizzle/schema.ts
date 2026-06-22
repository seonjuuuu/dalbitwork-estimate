import {
  boolean,
  integer,
  json,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const documentTypeEnum = pgEnum("document_type", [
  "proposal",
  "estimate",
]);
export const notesModeEnum = pgEnum("notes_mode", ["list", "freeform"]);
export const paymentTypeEnum = pgEnum("payment_type", ["deposit", "final"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const documents = pgTable("documents", {
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
  items: json("items").$type<DocumentItemRow[]>().notNull(),
  notes: json("notes").$type<string[]>().notNull(),
  notesMode: notesModeEnum("notesMode").default("list").notNull(),
  freeformNotes: text("freeformNotes"),
  templateVariables: json("templateVariables").$type<Record<string, string>>(),
  totalMin: integer("totalMin").default(0).notNull(),
  totalMax: integer("totalMax").default(0).notNull(),
  useRange: boolean("useRange").default(true).notNull(),
  extraDiscountType: varchar("extraDiscountType", { length: 20 }),
  extraDiscountValue: integer("extraDiscountValue").default(0).notNull(),
  contactPhone: varchar("contactPhone", { length: 50 }).default("").notNull(),
  businessType: varchar("businessType", { length: 100 }).default("").notNull(),
  optionalItems: json("optionalItems")
    .$type<OptionalItemRow[]>()
    .default([])
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export interface OptionalItemRow {
  id: string;
  name: string;
  description: string;
  quantity: string;
  price: string;
  payer: string;
}

export interface DocumentItemRow {
  id: string;
  name: string;
  quantity: string;
  unitPrice?: string;
  originalPrice: string;
  discountPrice: string;
  discountAmount?: string;
}

export type DocumentData = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

export const noteTemplates = pgTable("note_templates", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  notes: json("notes").$type<string[]>().notNull(),
  mode: notesModeEnum("mode").default("list").notNull(),
  freeformNotes: text("freeformNotes"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export type NoteTemplate = typeof noteTemplates.$inferSelect;
export type InsertNoteTemplate = typeof noteTemplates.$inferInsert;

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  documentId: integer("documentId").notNull(),
  type: paymentTypeEnum("type").notNull(),
  amount: integer("amount").notNull(),
  paymentDate: varchar("paymentDate", { length: 20 }).notNull(),
  notes: text("notes"),
  cashReceiptIssued: boolean("cashReceiptIssued").default(false).notNull(),
  cashReceiptDate: varchar("cashReceiptDate", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

export const clientStatusEnum = pgEnum("client_status", [
  "상담",
  "제안서",
  "계약",
  "완료",
]);
export const workflowStatusEnum = pgEnum("workflow_status", [
  "상담",
  "진행대기",
  "작업진행중",
  "PC검수",
  "모바일작업중",
  "고객전달",
  "완료",
]);

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  contactName: varchar("contactName", { length: 200 }).default("").notNull(),
  contactPhone: varchar("contactPhone", { length: 50 }).default("").notNull(),
  businessNumber: varchar("businessNumber", { length: 50 })
    .default("")
    .notNull(),
  contractDate: varchar("contractDate", { length: 20 }).default("").notNull(),
  contractAmount: integer("contractAmount").default(0).notNull(),
  status: clientStatusEnum("status").default("상담").notNull(),
  memo: text("memo").default("").notNull(),
  isWorking: boolean("isWorking").default(false).notNull(),
  workStartDate: varchar("workStartDate", { length: 20 }).default("").notNull(),
  pcDraftDate: varchar("pcDraftDate", { length: 20 }).default("").notNull(),
  mobileDraftDate: varchar("mobileDraftDate", { length: 20 })
    .default("")
    .notNull(),
  finalDeliveryDate: varchar("finalDeliveryDate", { length: 20 })
    .default("")
    .notNull(),
  linkedEstimateId: integer("linkedEstimateId"),
  workflowStatus: workflowStatusEnum("workflowStatus")
    .default("상담")
    .notNull(),
  workflowCompletedAt: timestamp("workflowCompletedAt"),
  finalPaymentDate: varchar("finalPaymentDate", { length: 20 }),
  finalPaymentAmount: integer("finalPaymentAmount"),
  cashReceiptIssued: boolean("cashReceiptIssued").default(false).notNull(),
  cashReceiptDate: varchar("cashReceiptDate", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

export const consultations = pgTable("consultations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  clientId: integer("clientId").notNull(),
  date: varchar("date", { length: 20 }).notNull(),
  content: text("content").notNull(),
  nextAction: text("nextAction").default("").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export type Consultation = typeof consultations.$inferSelect;
export type InsertConsultation = typeof consultations.$inferInsert;

export const serviceItems = pgTable("service_items", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description").default("").notNull(),
  unitPrice: varchar("unitPrice", { length: 50 }).default("").notNull(),
  category: varchar("category", { length: 100 }).default("").notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export type ServiceItem = typeof serviceItems.$inferSelect;
export type InsertServiceItem = typeof serviceItems.$inferInsert;

export const hktbInvoiceTypeEnum = pgEnum("hktb_invoice_type", [
  "translation",
  "retainer",
]);

export const hktbInvoices = pgTable("hktb_invoices", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: hktbInvoiceTypeEnum("type").notNull(),
  invoiceNo: varchar("invoiceNo", { length: 100 }).notNull(),
  invoiceDate: varchar("invoiceDate", { length: 20 }).notNull(),
  items: json("items").notNull(),
  totalAmount: integer("totalAmount").default(0).notNull(),
  revenueMonth: varchar("revenueMonth", { length: 7 }),
  cashReceiptIssued: boolean("cashReceiptIssued").default(false).notNull(),
  cashReceiptDate: varchar("cashReceiptDate", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export type HktbInvoice = typeof hktbInvoices.$inferSelect;
export type InsertHktbInvoice = typeof hktbInvoices.$inferInsert;

export const pdfFiles = pgTable("pdf_files", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  fileSize: integer("fileSize").notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PdfFile = typeof pdfFiles.$inferSelect;
export type InsertPdfFile = typeof pdfFiles.$inferInsert;
