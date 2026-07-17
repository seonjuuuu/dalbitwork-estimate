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
  unitPrice: z.string().optional().default(''),
});

// Zod schema for creating/updating a document
const documentInputSchema = z.object({
  type: z.enum(["proposal", "estimate"]),
  title: z.string().default(""),
  memo: z.string().nullable().default(null),
  clientName: z.string().default(""),
  contactName: z.string().default(""),
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
  useRange: z.boolean().default(true),
  extraDiscountType: z.enum(['percent', 'amount', 'direct']).nullable().optional(),
  extraDiscountValue: z.number().default(0),
  depositRatio: z.number().default(50),
  contactPhone: z.string().default(""),
  businessType: z.string().default(""),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(() => {
      return { success: true } as const;
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
          contactName: input.contactName,
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
          useRange: input.useRange,
          extraDiscountType: input.extraDiscountType ?? null,
          extraDiscountValue: input.extraDiscountValue ?? 0,
          depositRatio: input.depositRatio ?? 50,
          contactPhone: input.contactPhone,
          businessType: input.businessType,
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
        if (input.data.useRange !== undefined) updateData.useRange = input.data.useRange;
        if (input.data.extraDiscountType !== undefined) updateData.extraDiscountType = input.data.extraDiscountType ?? null;
        if (input.data.extraDiscountValue !== undefined) updateData.extraDiscountValue = input.data.extraDiscountValue;
        if (input.data.depositRatio !== undefined) updateData.depositRatio = input.data.depositRatio;
        if (input.data.contactPhone !== undefined) updateData.contactPhone = input.data.contactPhone;
        if (input.data.businessType !== undefined) updateData.businessType = input.data.businessType;
        if (input.data.contactName !== undefined) updateData.contactName = input.data.contactName;

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
          contactName: proposal.contactName,
          contactPhone: proposal.contactPhone,
          projectName: proposal.projectName,
          platform: proposal.platform,
          date: new Date().toISOString().split('T')[0],
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

    /** 제목·메모·고객 정보 제거 후 동일 타입으로 복사 */
    copyDocument: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const original = await db.getDocument(input.id, ctx.user.id);
        if (!original) throw new Error("Document not found");

        const copy = await db.createDocument({
          userId: ctx.user.id,
          type: original.type,
          title: '',
          memo: null,
          clientName: '',
          contactName: '',
          contactPhone: '',
          businessType: '',
          projectName: original.projectName,
          platform: original.platform,
          date: new Date().toISOString().split('T')[0],
          items: original.items as DocumentItemRow[],
          notes: original.notes,
          notesMode: original.notesMode,
          freeformNotes: original.freeformNotes,
          templateVariables: original.templateVariables,
          totalMin: original.totalMin,
          totalMax: original.totalMax,
          useRange: (original as any).useRange ?? true,
          extraDiscountType: (original as any).extraDiscountType ?? null,
          extraDiscountValue: (original as any).extraDiscountValue ?? 0,
        });
        return copy;
      }),

    /** Record a payment (계약금 확정) */
    recordPayment: protectedProcedure
      .input(
        z.object({
          documentId: z.number(),
          type: z.enum(["deposit", "final"]),
          amount: z.number(),
          paymentDate: z.string(),
          notes: z.string().optional(),
          cashReceiptIssued: z.boolean().optional(),
          cashReceiptDate: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const doc = await db.getDocument(input.documentId, ctx.user.id);
        if (!doc) {
          throw new Error("Document not found or not authorized");
        }

        const payment = await db.createPayment({
          userId: ctx.user.id,
          documentId: input.documentId,
          type: input.type,
          amount: input.amount,
          paymentDate: input.paymentDate,
          notes: input.notes || null,
          cashReceiptIssued: input.cashReceiptIssued ?? false,
          cashReceiptDate: input.cashReceiptIssued ? (input.cashReceiptDate ?? input.paymentDate) : null,
        });
        if (input.type === 'deposit') {
          await db.confirmDepositForClient(input.documentId, ctx.user.id);
        } else if (input.type === 'final') {
          await db.confirmFinalPaymentForClient(input.documentId, ctx.user.id, input.paymentDate, input.amount);
        }
        return payment;
      }),

    /** Get all payments for a document */
    getPayments: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getDocumentPayments(input.documentId, ctx.user.id);
      }),

    /** Get IDs of documents that already have a deposit recorded */
    getDepositedDocumentIds: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getDepositedDocumentIds(ctx.user.id);
      }),

    /** Get IDs of documents that already have a final payment recorded */
    getFinalPaidDocumentIds: protectedProcedure
      .query(async ({ ctx }) => {
        return db.getFinalPaidDocumentIds(ctx.user.id);
      }),
  }),

  clients: router({
    list: protectedProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return db.listClients(ctx.user.id, input?.search);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getClient(input.id, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        contactName: z.string().default(''),
        contactPhone: z.string().default(''),
        businessNumber: z.string().default(''),
        contractDate: z.string().default(''),
        contractAmount: z.number().default(0),
        memo: z.string().default(''),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createClient({ ...input, userId: ctx.user.id });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        contactName: z.string().optional(),
        contactPhone: z.string().optional(),
        businessNumber: z.string().optional(),
        contractDate: z.string().optional(),
        contractAmount: z.number().optional(),
        memo: z.string().optional(),
        status: z.enum(['상담', '제안서', '계약', '완료']).optional(),
        isWorking: z.boolean().optional(),
        workStartDate: z.string().optional(),
        pcDraftDate: z.string().optional(),
        mobileDraftDate: z.string().optional(),
        finalDeliveryDate: z.string().optional(),
        linkedEstimateId: z.number().nullable().optional(),
        finalPaymentDate: z.string().nullable().optional(),
        finalPaymentAmount: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return db.updateClient(id, ctx.user.id, data);
      }),

    getMatchedEstimates: protectedProcedure
      .input(z.object({ clientName: z.string() }))
      .query(async ({ ctx, input }) => {
        return db.getEstimatesByClientName(input.clientName, ctx.user.id);
      }),

    getMatchedProposals: protectedProcedure
      .input(z.object({ clientName: z.string() }))
      .query(async ({ ctx, input }) => {
        return db.getProposalsByClientName(input.clientName, ctx.user.id);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.deleteClient(input.id, ctx.user.id);
      }),

    upsertFromDocument: protectedProcedure
      .input(z.object({
        name: z.string(),
        contactName: z.string().default(''),
        contactPhone: z.string().default(''),
        isEstimate: z.boolean().default(false),
        contractDate: z.string().optional(),
        contractAmount: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.upsertClientFromDocument(ctx.user.id, input);
      }),
  }),

  consultations: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.listConsultations(input.clientId, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        date: z.string(),
        content: z.string().min(1),
        nextAction: z.string().default(''),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createConsultation({ ...input, userId: ctx.user.id });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        date: z.string().optional(),
        content: z.string().optional(),
        nextAction: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return db.updateConsultation(id, ctx.user.id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.deleteConsultation(input.id, ctx.user.id);
      }),
  }),

  serviceItems: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.listServiceItems(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().default(''),
        unitPrice: z.string().default(''),
        category: z.string().default(''),
        sortOrder: z.number().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createServiceItem({ ...input, userId: ctx.user.id });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        unitPrice: z.string().optional(),
        category: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return db.updateServiceItem(id, ctx.user.id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.deleteServiceItem(input.id, ctx.user.id);
      }),
  }),

  hktbInvoices: router({
    list: protectedProcedure
      .input(z.object({ type: z.enum(["translation", "retainer"]).optional() }).optional())
      .query(async ({ ctx, input }) => {
        return db.listHktbInvoices(ctx.user.id, input?.type);
      }),

    create: protectedProcedure
      .input(z.object({
        type: z.enum(["translation", "retainer"]),
        invoiceNo: z.string(),
        invoiceDate: z.string(),
        items: z.array(z.record(z.string(), z.unknown())),
        totalAmount: z.number().default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createHktbInvoice({
          userId: ctx.user.id,
          type: input.type,
          invoiceNo: input.invoiceNo,
          invoiceDate: input.invoiceDate,
          items: input.items,
          totalAmount: input.totalAmount,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        invoiceNo: z.string().optional(),
        invoiceDate: z.string().optional(),
        items: z.array(z.record(z.string(), z.unknown())).optional(),
        totalAmount: z.number().optional(),
        revenueMonth: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return db.updateHktbInvoice(id, ctx.user.id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.deleteHktbInvoice(input.id, ctx.user.id);
      }),
  }),

  dashboard: router({
    getData: protectedProcedure.query(async ({ ctx }) => {
      return db.getDashboardData(ctx.user.id);
    }),
  }),

  kanban: router({
    getClients: protectedProcedure.query(async ({ ctx }) => {
      return db.getKanbanClients(ctx.user.id);
    }),
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        workflowStatus: z.enum(['상담', '진행대기', '작업진행중', 'PC검수', '모바일작업중', '고객전달', '완료']),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.updateClientWorkflowStatus(input.id, ctx.user.id, input.workflowStatus);
      }),
  }),

  sales: router({
    /** Get monthly sales data */
    getMonthly: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getMonthlySalesData(ctx.user.id, input.year, input.month);
      }),

    /** 일반 결제 현금영수증 */
    updatePaymentCashReceipt: protectedProcedure
      .input(z.object({ id: z.number(), issued: z.boolean(), date: z.string().nullable() }))
      .mutation(async ({ ctx, input }) => {
        await db.updatePaymentCashReceipt(input.id, ctx.user.id, input.issued, input.date);
      }),

    /** HKTB 인보이스 현금영수증 */
    updateHktbCashReceipt: protectedProcedure
      .input(z.object({ id: z.number(), issued: z.boolean(), date: z.string().nullable() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateHktbCashReceipt(input.id, ctx.user.id, input.issued, input.date);
      }),

    /** 잔금 수령 현금영수증 (clients 테이블) */
    updateFinalCashReceipt: protectedProcedure
      .input(z.object({ id: z.number(), issued: z.boolean(), date: z.string().nullable() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateClientCashReceipt(input.id, ctx.user.id, input.issued, input.date);
      }),

    /** 일반 결제 메모 */
    updatePaymentMemo: protectedProcedure
      .input(z.object({ id: z.number(), memo: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.updatePaymentMemo(input.id, ctx.user.id, input.memo);
      }),

    /** HKTB 인보이스 메모 */
    updateHktbMemo: protectedProcedure
      .input(z.object({ id: z.number(), memo: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateHktbMemo(input.id, ctx.user.id, input.memo);
      }),

    /** 잔금 수령 메모 (clients.finalPaymentMemo) */
    updateFinalMemo: protectedProcedure
      .input(z.object({ id: z.number(), memo: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateFinalPaymentMemo(input.id, ctx.user.id, input.memo);
      }),
  }),

  calendar: router({
    getEvents: protectedProcedure.query(async ({ ctx }) => {
      return db.getCalendarEvents(ctx.user.id);
    }),
    getWorkRanges: protectedProcedure.query(async ({ ctx }) => {
      return db.getWorkRanges(ctx.user.id);
    }),
  }),

  pdfFiles: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.listPdfFiles(ctx.user.id);
    }),
    listByClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.listPdfFilesByClient(input.clientId, ctx.user.id);
      }),
    upload: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        fileSize: z.number(),
        data: z.string(), // base64
        clientId: z.number().optional(),
        mimeType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.uploadPdfFile(ctx.user.id, input.name, input.fileSize, input.data, input.clientId, input.mimeType);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.getPdfFile(input.id, ctx.user.id);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.deletePdfFile(input.id, ctx.user.id);
      }),
  }),

  todos: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.listTodos(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        content: z.string().min(1),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        clientId: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createTodo(ctx.user.id, input.content, input.priority, input.clientId ?? null);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        content: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        clientId: z.number().nullable().optional(),
        completed: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return db.updateTodo(id, ctx.user.id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.deleteTodo(input.id, ctx.user.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
