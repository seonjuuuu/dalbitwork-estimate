import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Documents table for storing proposals (제안서) and estimates (견적서).
 * All form data is stored as JSON for flexibility.
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  /** Owner user ID (FK to users.id) */
  userId: int("userId").notNull(),
  /** Document type: proposal or estimate */
  type: mysqlEnum("type", ["proposal", "estimate"]).notNull(),
  /** Internal title for management (not shown in PDF) */
  title: varchar("title", { length: 500 }).default("").notNull(),
  /** Internal memo for management (not shown in PDF) */
  memo: text("memo"),
  /** Client/recipient name */
  clientName: varchar("clientName", { length: 500 }).default("").notNull(),
  /** Project name */
  projectName: varchar("projectName", { length: 500 }).default("").notNull(),
  /** Platform info */
  platform: varchar("platform", { length: 200 }).default("").notNull(),
  /** Document date (YYYY-MM-DD) */
  date: varchar("date", { length: 20 }).default("").notNull(),
  /** Line items as JSON array */
  items: json("items").$type<DocumentItemRow[]>().notNull(),
  /** Reference notes as JSON array of strings */
  notes: json("notes").$type<string[]>().notNull(),
  /** Notes display mode: 'list' for numbered items, 'freeform' for free-text */
  notesMode: mysqlEnum("notesMode", ["list", "freeform"]).default("list").notNull(),
  /** Freeform notes content (used when notesMode is 'freeform') */
  freeformNotes: text("freeformNotes"),
  /** Template variables for placeholder substitution (e.g. {{계약금}} → "325,000원") */
  templateVariables: json("templateVariables").$type<Record<string, string>>(),
  /** Total minimum amount */
  totalMin: int("totalMin").default(0).notNull(),
  /** Total maximum amount */
  totalMax: int("totalMax").default(0).notNull(),
  /** Contact person phone number */
  contactPhone: varchar("contactPhone", { length: 50 }).default("").notNull(),
  /** Business category/type */
  businessType: varchar("businessType", { length: 100 }).default("").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Shape of each item stored in the JSON `items` column */
export interface DocumentItemRow {
  id: string;
  name: string;
  quantity: string;
  originalPrice: string;
  discountPrice: string;
  discountAmount?: string; // 할인금액 (선택, 입력 시 할인가 자동 계산)
}

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Note templates table for storing reusable reference notes.
 * Each template has a name and an array of note strings.
 */
export const noteTemplates = mysqlTable("note_templates", {
  id: int("id").autoincrement().primaryKey(),
  /** Owner user ID (FK to users.id) */
  userId: int("userId").notNull(),
  /** Template name for identification */
  name: varchar("name", { length: 500 }).notNull(),
  /** Notes content as JSON array of strings */
  notes: json("notes").$type<string[]>().notNull(),
  /** Template mode: 'list' for numbered items, 'freeform' for free-text */
  mode: mysqlEnum("mode", ["list", "freeform"]).default("list").notNull(),
  /** Freeform notes content (used when mode is 'freeform') */
  freeformNotes: text("freeformNotes"),
  /** Display order for sorting */
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NoteTemplate = typeof noteTemplates.$inferSelect;
export type InsertNoteTemplate = typeof noteTemplates.$inferInsert;
