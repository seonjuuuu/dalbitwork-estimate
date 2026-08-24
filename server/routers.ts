import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import * as db from "./db";
import type { DocumentItemRow, OptionalItemRow } from "../drizzle/schema";
import { generateEstimateDraft, generateSiteStructure, classifyIntakeFormFields, suggestAdditionalIntakeQuestions, generateClientRequestChecklist, generateEmailDraft, generateSmsDraft } from "./ai";
import { notifyUser } from "./push";
import { sendMail, sendHktbMail, buildEmailHtml, APP_BASE_URL, PUBLIC_FORM_BASE_URL } from "./mailer";
import { ENV } from "./_core/env";
import { parseCardStatementXlsx } from "./cardStatementParser";

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

// Zod schema for optional-item validation (선택사항, excluded from the total)
const optionalItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  quantity: z.string().default('1'),
  price: z.string().default(''),
  payer: z.string().default(''),
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
  optionalItems: z.array(optionalItemSchema).default([]),
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
  contactEmail: z.string().default(""),
  noContact: z.boolean().default(false),
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
          optionalItems: input.optionalItems as OptionalItemRow[],
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
          contactEmail: input.contactEmail,
          noContact: input.noContact,
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
        if (input.data.optionalItems !== undefined) updateData.optionalItems = input.data.optionalItems;
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
        if (input.data.contactEmail !== undefined) updateData.contactEmail = input.data.contactEmail;
        if (input.data.noContact !== undefined) updateData.noContact = input.data.noContact;
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
          contactEmail: proposal.contactEmail,
          noContact: proposal.noContact,
          projectName: proposal.projectName,
          platform: proposal.platform,
          date: new Date().toISOString().split('T')[0],
          items: proposal.items as DocumentItemRow[],
          optionalItems: proposal.optionalItems as OptionalItemRow[],
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
          contactEmail: '',
          noContact: false,
          businessType: '',
          projectName: original.projectName,
          platform: original.platform,
          date: new Date().toISOString().split('T')[0],
          items: original.items as DocumentItemRow[],
          optionalItems: original.optionalItems as OptionalItemRow[],
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
        contactEmail: z.string().default(''),
        noContact: z.boolean().default(false),
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
        contactEmail: z.string().optional(),
        noContact: z.boolean().optional(),
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
        contactEmail: z.string().default(''),
        noContact: z.boolean().default(false),
        isEstimate: z.boolean().default(false),
        contractDate: z.string().optional(),
        contractAmount: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.upsertClientFromDocument(ctx.user.id, input);
      }),

    /** AI로 생성한 홈페이지 구성안을 고객사 전용 이력에 추가 (일반 메모와 분리, 기존 이력은 유지) */
    addSiteStructure: protectedProcedure
      .input(z.object({
        id: z.number(),
        entry: z.object({
          menuStructure: z.array(z.object({
            label: z.string(),
            subItems: z.array(z.string()),
          })),
          questions: z.array(z.string()),
          summary: z.string(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClient(input.id, ctx.user.id);
        if (!client) throw new Error("Client not found");
        const newEntry = {
          id: nanoid(),
          ...input.entry,
          generatedAt: new Date().toISOString(),
        };
        const updated = [...(client.siteStructures || []), newEntry];
        return db.updateClient(input.id, ctx.user.id, { siteStructures: updated });
      }),

    /** AI 구성안 이력에서 특정 항목 삭제 */
    deleteSiteStructure: protectedProcedure
      .input(z.object({ id: z.number(), entryId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClient(input.id, ctx.user.id);
        if (!client) throw new Error("Client not found");
        const updated = (client.siteStructures || []).filter(e => e.id !== input.entryId);
        return db.updateClient(input.id, ctx.user.id, { siteStructures: updated });
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

    /** 인보이스 PDF를 첨부해서 이메일 발송 (PDF는 클라이언트에서 base64로 만들어서 전달) */
    sendEmail: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          to: z.string().email(),
          subject: z.string().min(1),
          body: z.string().min(1),
          pdfBase64: z.string().min(1),
          filename: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await sendHktbMail(input.to, input.subject, input.body, [
          { filename: input.filename, content: Buffer.from(input.pdfBase64, "base64"), contentType: "application/pdf" },
        ]);
        return db.updateHktbInvoice(input.id, ctx.user.id, {
          emailSentAt: new Date(),
          emailSentTo: input.to,
        });
      }),

    /** 관리비 인보이스 2개월 주기 자동 준비/알림 on-off (재계약 안 된 해에는 꺼서 알림을 멈출 수 있음) */
    setAutoReminderEnabled: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        return db.setHktbRetainerAutoEnabled(ctx.user.id, input.enabled);
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

    /** 계약금/잔금 입금 기록 수정 (금액·날짜 정정용) */
    updatePayment: protectedProcedure
      .input(z.object({ id: z.number(), amount: z.number(), paymentDate: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return db.updatePayment(input.id, ctx.user.id, { amount: input.amount, paymentDate: input.paymentDate });
      }),

    /** 계약금/잔금 입금 기록 삭제 (중복 확정 등 정정용) */
    deletePayment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deletePayment(input.id, ctx.user.id);
        return { success: true };
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
    /** 미팅 등 자유롭게 등록하는 일정 추가 */
    createCustomEvent: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(200),
          date: z.string().min(1),
          memo: z.string().optional(),
          clientId: z.number().optional(),
          isMeeting: z.boolean().optional(),
          time: z.string().optional(),
          timeUnknown: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.createCustomEvent(ctx.user.id, input);
      }),
    /** 자유 등록 일정 수정 */
    updateCustomEvent: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).max(200),
          date: z.string().min(1),
          memo: z.string().optional(),
          clientId: z.number().optional(),
          isMeeting: z.boolean().optional(),
          time: z.string().optional(),
          timeUnknown: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return db.updateCustomEvent(ctx.user.id, id, data);
      }),
    deleteCustomEvent: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.deleteCustomEvent(ctx.user.id, input.id);
      }),
    /** 특정 고객에 연결된 자유 등록 일정(미팅 등) 목록 */
    listCustomEventsByClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.listCustomEventsByClient(ctx.user.id, input.clientId);
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

  ai: router({
    /** 문의 내용을 분석해 제안서/견적서 초안(프로젝트 정보·품목·참고사항)을 생성 */
    draftEstimate: protectedProcedure
      .input(
        z.object({
          inquiryText: z.string().min(1),
          docType: z.enum(["proposal", "estimate"]).default("proposal"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const serviceItems = await db.listServiceItems(ctx.user.id);
        const draft = await generateEstimateDraft(
          input.inquiryText,
          serviceItems.map(i => ({
            name: i.name,
            description: i.description,
            unitPrice: i.unitPrice,
            category: i.category,
          })),
          input.docType
        );

        const itemsByName = new Map(serviceItems.map(i => [i.name, i]));
        const items = draft.items
          .map(di => {
            const match = itemsByName.get(di.serviceItemName);
            if (!match) return null;
            const unitPriceNum = parseInt((match.unitPrice || "0").replace(/[^0-9]/g, ""), 10) || 0;
            const total = unitPriceNum * di.quantity;
            return {
              name: match.name,
              quantity: String(di.quantity),
              unitPrice: match.unitPrice || "",
              originalPrice: total.toLocaleString("ko-KR"),
              discountPrice: "",
              discountAmount: "",
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

        const optionalItems = draft.optionalItems
          .map(oi => {
            const match = itemsByName.get(oi.serviceItemName);
            if (!match) return null;
            return {
              id: nanoid(),
              name: match.name,
              description: match.description || "",
              quantity: "1",
              price: match.unitPrice ? Number(match.unitPrice.replace(/[^0-9]/g, "")).toLocaleString("ko-KR") : "",
              payer: "당사",
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

        // 도메인/호스팅/SSL 비용 고지는 AI에게 맡기지 않고 항상 고정으로 추가 (정책 누락 방지)
        optionalItems.push({
          id: nanoid(),
          name: "도메인/호스팅/SSL (연 단위)",
          description: "견적 합계에 포함되지 않으며 고객사(사업주)가 직접 결제합니다.",
          quantity: "1",
          price: "",
          payer: "고객사",
        });

        // SEO 설정도 AI 판단에 맡기지 않고 항상 선택사항으로 추가 (10만원)
        if (!optionalItems.some(oi => oi.name === "SEO 등록")) {
          const seoCatalogItem = itemsByName.get("SEO 등록");
          optionalItems.push({
            id: nanoid(),
            name: "SEO 등록",
            description: seoCatalogItem?.description || "네이버·구글 검색엔진 등록 및 기본 SEO 설정",
            quantity: "1",
            price: seoCatalogItem?.unitPrice
              ? Number(seoCatalogItem.unitPrice.replace(/[^0-9]/g, "")).toLocaleString("ko-KR")
              : "100,000",
            payer: "당사",
          });
        }

        // 추가 페이지 비용이 포함된 경우, 페이지 내용/구성에 따라 금액이 달라질 수 있음을 항상 고지
        const notes = items.some(i => i.name === "추가 페이지")
          ? [...draft.notes, "추가 페이지 비용은 페이지당 15만원 기준으로 산정했으며, 실제 내용과 구성에 따라 금액은 변동될 수 있습니다."]
          : draft.notes;

        return {
          projectName: draft.projectName,
          platform: draft.platform,
          businessType: draft.businessType,
          items,
          optionalItems,
          notes,
          summary: draft.summary,
        };
      }),

    /** 상담 내용을 분석해 홈페이지 메뉴 구성안 + 고객에게 확인할 질문 목록을 생성 (기존 구성안이 있으면 그 위에 얹어서 업데이트) */
    generateSiteStructure: protectedProcedure
      .input(
        z.object({
          clientId: z.number(),
          consultationText: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClient(input.clientId, ctx.user.id);
        const previousEntry = client?.siteStructures?.[client.siteStructures.length - 1];
        const previous = previousEntry
          ? { menuStructure: previousEntry.menuStructure, questions: previousEntry.questions, summary: previousEntry.summary }
          : undefined;
        return generateSiteStructure(input.consultationText, previous);
      }),

    /** 고객사 정보·상담 이력을 참고해 제작 전 고객에게 요청할 준비자료 체크리스트 + 발송용 안내 메시지를 생성 */
    generateClientRequestChecklist: protectedProcedure
      .input(z.object({ clientId: z.number(), formLink: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClient(input.clientId, ctx.user.id);
        if (!client) throw new Error("고객사를 찾을 수 없습니다.");
        const consultations = await db.listConsultations(input.clientId, ctx.user.id);
        return generateClientRequestChecklist(
          {
            clientName: client.name,
            memo: client.memo,
            consultations: consultations.map((c) => c.content).filter(Boolean),
            existingQuestions: [],
          },
          input.formLink
        );
      }),

    /** 담당자가 입력한 목적을 바탕으로 이메일 초안(제목+본문) 생성 — 자료 요청 외 임의의 목적 */
    generateEmailDraft: protectedProcedure
      .input(z.object({ clientId: z.number(), purpose: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClient(input.clientId, ctx.user.id);
        if (!client) throw new Error("고객사를 찾을 수 없습니다.");
        return generateEmailDraft({
          clientName: client.name,
          memo: client.memo,
          purpose: input.purpose,
        });
      }),

    /** 담당자가 입력한 목적을 바탕으로 문자용 초안(짧고 친근한 말투) 생성 */
    generateSmsDraft: protectedProcedure
      .input(z.object({ clientId: z.number(), purpose: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClient(input.clientId, ctx.user.id);
        if (!client) throw new Error("고객사를 찾을 수 없습니다.");
        return generateSmsDraft({
          clientName: client.name,
          memo: client.memo,
          purpose: input.purpose,
        });
      }),
  }),

  expenses: router({
    /**
     * 카드사 이용내역 엑셀을 파싱만 해서 돌려준다 (저장하지 않음).
     * 이전에 같은 가맹점을 어떤 카테고리로 저장했었는지도 함께 내려줘서
     * 프론트에서 미리 체크된 상태로 검토할 수 있게 한다.
     */
    parse: protectedProcedure
      .input(z.object({ data: z.string() })) // base64 xlsx
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.data, "base64");
        const parsed = parseCardStatementXlsx(buffer);
        if (parsed.length === 0) {
          throw new Error("엑셀에서 거래 내역을 찾지 못했습니다. 파일 형식을 확인해주세요.");
        }
        const rules = await db.getExpenseMerchantRules(ctx.user.id);
        return parsed.map((row) => ({
          ...row,
          suggestedCategory: rules.get(row.merchant) ?? null,
        }));
      }),
    /** 검토를 마치고 카테고리를 지정한 항목만 저장 (가맹점 카테고리 규칙도 함께 갱신) */
    save: protectedProcedure
      .input(
        z.object({
          entries: z.array(
            z.object({
              date: z.string(),
              time: z.string().optional(),
              merchant: z.string(),
              amount: z.number(),
              currency: z.enum(["KRW", "USD"]).optional(),
              installment: z.string().optional(),
              approvalNo: z.string(),
              category: z.enum(["ad_spend", "ai_cost"]),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.saveExpenseEntries(ctx.user.id, input.entries);
      }),
    /** 월×카테고리별 합계 */
    monthlySummary: protectedProcedure.query(async ({ ctx }) => {
      return db.getExpenseMonthlySummary(ctx.user.id);
    }),
    /** 연도별 그래프용 데이터 */
    yearlySummary: protectedProcedure.query(async ({ ctx }) => {
      return db.getExpenseYearlySummary(ctx.user.id);
    }),
    /** 특정 월에 저장된 지출을 전부 삭제 (다시 업로드해서 새로 체크하고 싶을 때) */
    deleteMonth: protectedProcedure
      .input(z.object({ month: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return db.deleteExpensesForMonth(ctx.user.id, input.month);
      }),
  }),

  forms: router({
    /** 질문 목록을 AI로 분석해서 입력 형태(단답/장문/객관식)를 자동 분류 */
    classifyFields: protectedProcedure
      .input(z.object({ questions: z.array(z.object({ text: z.string().min(1), required: z.boolean() })) }))
      .mutation(async ({ input }) => {
        return classifyIntakeFormFields(input.questions);
      }),
    /** 고객사 메모·상담 이력을 참고해 기본 질문 외 추가 질문을 AI로 제안 */
    suggestQuestions: protectedProcedure
      .input(z.object({ clientId: z.number(), existingQuestions: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClient(input.clientId, ctx.user.id);
        if (!client) return [];
        const consultations = await db.listConsultations(input.clientId, ctx.user.id);
        return suggestAdditionalIntakeQuestions({
          clientName: client.name,
          memo: client.memo,
          consultations: consultations.map((c) => c.content).filter(Boolean),
          existingQuestions: input.existingQuestions,
        });
      }),
    /** 고객에게 보낼 질문폼 링크 생성 */
    create: protectedProcedure
      .input(
        z.object({
          clientId: z.number(),
          questions: z
            .array(
              z.object({
                text: z.string().min(1),
                required: z.boolean(),
                type: z.enum(["text", "textarea", "select"]),
                options: z.array(z.string()).optional(),
              })
            )
            .min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const token = nanoid(8);
        const shortLink = `${PUBLIC_FORM_BASE_URL}/f/${token}`;
        return db.createIntakeForm(ctx.user.id, input.clientId, token, input.questions, shortLink);
      }),
    listByClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.listIntakeFormsByClient(ctx.user.id, input.clientId);
      }),
    deleteForm: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.deleteIntakeForm(ctx.user.id, input.id);
      }),
    /** 공개 폼 페이지 — 로그인 불필요, 토큰만으로 접근 */
    getByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const form = await db.getIntakeFormByToken(input.token);
        if (!form) return null;
        // userId는 서버 내부용이라 공개 응답에서는 제외
        const { userId: _userId, ...publicForm } = form;
        return publicForm;
      }),
    /** 공개 폼 제출 — 로그인 불필요, 토큰만으로 처리 */
    submit: publicProcedure
      .input(z.object({ token: z.string(), answers: z.array(z.string()) }))
      .mutation(async ({ input }) => {
        const before = await db.getIntakeFormByToken(input.token);
        if (!before) throw new Error("유효하지 않은 링크입니다.");
        if (before.status === "submitted") throw new Error("이미 제출된 폼입니다.");
        const missingRequired = before.questions.some(
          (q, i) => q.required && !(input.answers[i] || "").trim()
        );
        if (missingRequired) throw new Error("필수 항목(*)을 모두 입력해주세요.");

        const updated = await db.submitIntakeForm(input.token, input.answers);
        if (!updated) throw new Error("제출에 실패했습니다.");

        await notifyUser(before.userId, {
          title: "질문폼 답변 도착",
          body: `${before.clientName || "고객"}님이 홈페이지 제작 질문폼에 답변을 제출했어요.`,
          url: `/clients/${before.clientId}`,
        }).catch(() => {});

        return { success: true };
      }),
  }),

  clientEmails: router({
    /** 고객에게 이메일 발송 (Gmail) + 발송 이력 기록 */
    send: protectedProcedure
      .input(
        z.object({
          clientId: z.number(),
          to: z.string().email(),
          subject: z.string().min(1),
          body: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await sendMail(input.to, input.subject, input.body);
        return db.createClientEmail(ctx.user.id, input.clientId, input.to, input.subject, input.body, "email");
      }),
    /** 문자 등으로 수동 발송한 경우 — 실제 전송은 하지 않고 발송완료만 이력에 기록 */
    logManualSend: protectedProcedure
      .input(
        z.object({
          clientId: z.number(),
          to: z.string().optional(),
          subject: z.string().optional(),
          body: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.createClientEmail(ctx.user.id, input.clientId, input.to || "", input.subject || "", input.body, "sms");
      }),
    listByClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.listClientEmailsByClient(ctx.user.id, input.clientId);
      }),
    /** 발송 이력 삭제 (테스트로 보낸 경우 등) */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.deleteClientEmail(ctx.user.id, input.id);
      }),
    /** 실제 발송될 이메일 HTML(본문+서명)을 그대로 미리보기용으로 반환 */
    preview: protectedProcedure
      .input(z.object({ body: z.string() }))
      .query(({ input }) => ({ html: buildEmailHtml(input.body) })),
  }),

  push: router({
    /** 프론트에서 알림 구독을 만들 때 필요한 VAPID 공개키 */
    getPublicKey: publicProcedure.query(() => ({
      publicKey: ENV.vapidPublicKey,
    })),

    /** 이 기기의 푸시 구독 정보를 저장 (알림 켜기) */
    subscribe: protectedProcedure
      .input(
        z.object({
          endpoint: z.string(),
          p256dh: z.string(),
          auth: z.string(),
          userAgent: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.savePushSubscription(ctx.user.id, input);
      }),

    /** 이 기기의 구독 해제 (알림 끄기) */
    unsubscribe: protectedProcedure
      .input(z.object({ endpoint: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return db.deletePushSubscription(ctx.user.id, input.endpoint);
      }),

    /** 현재 로그인한 유저가 켜둔 구독 기기 수 */
    listMine: protectedProcedure.query(async ({ ctx }) => {
      const subs = await db.listPushSubscriptions(ctx.user.id);
      return subs.map(s => ({ id: s.id, endpoint: s.endpoint, userAgent: s.userAgent, createdAt: s.createdAt }));
    }),

    /** 테스트 알림 발송 (웹 푸시 + 폴링 이벤트 기록을 함께 처리) */
    sendTest: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await notifyUser(ctx.user.id, {
        title: "달빛워크 어드민",
        body: "테스트 알림이에요. 잘 도착했다면 정상 작동하는 거예요!",
        url: "/",
      });
      return { sent: result.sent, total: result.total };
    }),

    /**
     * 웹 푸시를 지원하지 않는 클라이언트(데스크탑 앱 등)가 새 알림 이벤트를
     * 주기적으로 확인해가기 위한 폴링 엔드포인트
     */
    pollEvents: protectedProcedure
      .input(z.object({ sinceId: z.number().default(0) }))
      .query(async ({ ctx, input }) => {
        const events = await db.listNotificationEventsSince(ctx.user.id, input.sinceId);
        return events.map((e) => ({
          id: e.id,
          title: e.title,
          body: e.body,
          url: e.url,
          createdAt: e.createdAt,
        }));
      }),
  }),

  todos: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.listTodos(ctx.user.id);
    }),
    /** 날짜가 있고 특정 고객에 연결된 할 일만 (고객 상세페이지 노출용) */
    listByClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.listTodosByClient(ctx.user.id, input.clientId);
      }),
    create: protectedProcedure
      .input(z.object({
        content: z.string().min(1),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        clientId: z.number().nullable().optional(),
        dueDate: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createTodo(ctx.user.id, input.content, input.priority, input.clientId ?? null, input.dueDate);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        content: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        clientId: z.number().nullable().optional(),
        completed: z.boolean().optional(),
        dueDate: z.string().nullable().optional(),
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
