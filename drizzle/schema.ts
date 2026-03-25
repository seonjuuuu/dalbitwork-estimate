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
  /** Total minimum amount */
  totalMin: int("totalMin").default(0).notNull(),
  /** Total maximum amount */
  totalMax: int("totalMax").default(0).notNull(),
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
}

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
