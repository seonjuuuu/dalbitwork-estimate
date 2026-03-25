import { relations } from "drizzle-orm";
import { documents, noteTemplates, users } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  noteTemplates: many(noteTemplates),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}));

export const noteTemplatesRelations = relations(noteTemplates, ({ one }) => ({
  user: one(users, {
    fields: [noteTemplates.userId],
    references: [users.id],
  }),
}));
