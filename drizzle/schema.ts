import { integer, json, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const documentTypeEnum = pgEnum("document_type", ["proposal", "estimate"]);
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdateFn(() => new Date()),
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
  contactPhone: varchar("contactPhone", { length: 50 }).default("").notNull(),
  businessType: varchar("businessType", { length: 100 }).default("").notNull(),
  optionalItems: json("optionalItems").$type<OptionalItemRow[]>().default([]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdateFn(() => new Date()),
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdateFn(() => new Date()),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;
