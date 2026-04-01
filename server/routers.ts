import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import type { DocumentItemRow } from "../drizzle/schema";

// Zod schema for document item validation
const documentItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.string(),
  originalPrice: z.string(),
  discountPrice: z.string(),
  discountAmount: z.string().optional().default(''),
});

// Zod schema for creating/updating a document
const documentInputSchema = z.object({
  type: z.enum(["proposal", "estimate"]),
  title: z.string().default(""),
  memo: z.string().nullable().default(null),
  clientName: z.string().default(""),
  projectName: z.string().default(""),
  platform: z.string().default(""),
  date: z.string().default(""),
  items: z.array(documentItemSchema),
  notes: z.array(z.string()),
  notesMode: z.enum(["list", "freeform"]).default("list"),
  freeformNotes: z.string().nullable().default(null),
  templateVariables: z.record(z.string(), z.string()).nullable().default(null),
  totalMin: z.number().default(0),
  totalMax: z.number().default(0),
  contactPhone: z.string().default(""),
  businessType: z.string().default(""),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  noteTemplates: router({
    /** List all note templates for the logged-in user */
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.listNoteTemplates(ctx.user.id);
    }),

    /** Get a single note template by ID */
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const tmpl = await db.getNoteTemplate(input.id, ctx.user.id);
        if (!tmpl) throw new Error("Template not found");
        return tmpl;
      }),

    /** Create a new note template */
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          notes: z.array(z.string()),
          mode: z.enum(["list", "freeform"]).default("list"),
          freeformNotes: z.string().nullable().default(null),
          sortOrder: z.number().default(0),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.createNoteTemplate({
          userId: ctx.user.id,
          name: input.name,
          notes: input.notes,
          mode: input.mode,
          freeformNotes: input.freeformNotes,
          sortOrder: input.sortOrder,
        });
      }),

    /** Update an existing note template */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: z.object({
            name: z.string().min(1).optional(),
            notes: z.array(z.string()).optional(),
            mode: z.enum(["list", "freeform"]).optional(),
            freeformNotes: z.string().nullable().optional(),
            sortOrder: z.number().optional(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const updateData: Record<string, unknown> = {};
        if (input.data.name !== undefined) updateData.name = input.data.name;
        if (input.data.notes !== undefined) updateData.notes = input.data.notes;
        if (input.data.mode !== undefined) updateData.mode = input.data.mode;
        if (input.data.freeformNotes !== undefined) updateData.freeformNotes = input.data.freeformNotes;
        if (input.data.sortOrder !== undefined) updateData.sortOrder = input.data.sortOrder;

        const tmpl = await db.updateNoteTemplate(input.id, ctx.user.id, updateData);
        if (!tmpl) throw new Error("Template not found or not authorized");
        return tmpl;
      }),

    /** Delete a note template */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.deleteNoteTemplate(input.id, ctx.user.id);
      }),

    /** Save current document notes as a new template */
    saveFromDocument: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          notes: z.array(z.string()),
          mode: z.enum(["list", "freeform"]).default("list"),
          freeformNotes: z.string().nullable().default(null),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.createNoteTemplate({
          userId: ctx.user.id,
          name: input.name,
          notes: input.notes,
          mode: input.mode,
          freeformNotes: input.freeformNotes,
          sortOrder: 0,
        });
      }),
  }),

  documents: router({
    /** List documents for the logged-in user, optionally filtered by type */
    list: protectedProcedure
      .input(
        z.object({
          type: z.enum(["proposal", "estimate"]).optional(),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        return db.listDocuments(ctx.user.id, input?.type);
      }),

    /** Get a single document by ID */
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const doc = await db.getDocument(input.id, ctx.user.id);
        if (!doc) {
          throw new Error("Document not found");
        }
        return doc;
      }),

    /** Create a new document */
    create: protectedProcedure
      .input(documentInputSchema)
      .mutation(async ({ ctx, input }) => {
        const doc = await db.createDocument({
          userId: ctx.user.id,
          type: input.type,
          title: input.title,
          memo: input.memo,
          clientName: input.clientName,
          projectName: input.projectName,
          platform: input.platform,
          date: input.date,
          items: input.items as DocumentItemRow[],
          notes: input.notes,
          notesMode: input.notesMode,
          freeformNotes: input.freeformNotes,
          templateVariables: input.templateVariables,
          totalMin: input.totalMin,
          totalMax: input.totalMax,
        });
        return doc;
      }),

    /** Update an existing document */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: documentInputSchema.partial(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const updateData: Record<string, unknown> = {};
        if (input.data.type !== undefined) updateData.type = input.data.type;
        if (input.data.title !== undefined) updateData.title = input.data.title;
        if (input.data.memo !== undefined) updateData.memo = input.data.memo;
        if (input.data.clientName !== undefined) updateData.clientName = input.data.clientName;
        if (input.data.projectName !== undefined) updateData.projectName = input.data.projectName;
        if (input.data.platform !== undefined) updateData.platform = input.data.platform;
        if (input.data.date !== undefined) updateData.date = input.data.date;
        if (input.data.items !== undefined) updateData.items = input.data.items;
        if (input.data.notes !== undefined) updateData.notes = input.data.notes;
        if (input.data.notesMode !== undefined) updateData.notesMode = input.data.notesMode;
        if (input.data.freeformNotes !== undefined) updateData.freeformNotes = input.data.freeformNotes;
        if (input.data.templateVariables !== undefined) updateData.templateVariables = input.data.templateVariables;
        if (input.data.totalMin !== undefined) updateData.totalMin = input.data.totalMin;
        if (input.data.totalMax !== undefined) updateData.totalMax = input.data.totalMax;

        const doc = await db.updateDocument(input.id, ctx.user.id, updateData);
        if (!doc) {
          throw new Error("Document not found or not authorized");
        }
        return doc;
      }),

    /** Delete a document */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.deleteDocument(input.id, ctx.user.id);
      }),

    /** Duplicate a proposal as an estimate */
    duplicateAsEstimate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const proposal = await db.getDocument(input.id, ctx.user.id);
        if (!proposal) {
          throw new Error("Document not found");
        }
        if (proposal.type !== "proposal") {
          throw new Error("Only proposals can be duplicated as estimates");
        }

        const estimate = await db.createDocument({
          userId: ctx.user.id,
          type: "estimate",
          title: proposal.title,
          memo: proposal.memo,
          clientName: proposal.clientName,
          projectName: proposal.projectName,
          platform: proposal.platform,
          date: proposal.date,
          items: proposal.items as DocumentItemRow[],
          notes: proposal.notes,
          notesMode: proposal.notesMode,
          freeformNotes: proposal.freeformNotes,
          templateVariables: proposal.templateVariables,
          totalMin: proposal.totalMin,
          totalMax: proposal.totalMax,
        });
        return estimate;
      }),

    markDepositPaid: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const today = new Date().toISOString().split('T')[0];
        const doc = await db.updateDocument(input.id, ctx.user.id, {
          depositPaidDate: today,
        });
        if (!doc) {
          throw new Error('Document not found or not authorized');
        }
        return doc;
      }),

    markFinalPaid: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const today = new Date().toISOString().split('T')[0];
        const doc = await db.updateDocument(input.id, ctx.user.id, {
          finalPaidDate: today,
        });
        if (!doc) {
          throw new Error('Document not found or not authorized');
        }
        return doc;
      }),
  }),
});

export type AppRouter = typeof appRouter;
