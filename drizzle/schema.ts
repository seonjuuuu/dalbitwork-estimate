import {
  boolean,
  doublePrecision,
  integer,
  json,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
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
  // HKTB 관리비 인보이스 2개월 주기 자동 준비/알림 on-off. 4월(2-3월분, 계약연도 마지막 주기)
  // 알림 발송 시 재계약 여부를 물어보고, 재계약 안 하면 이걸 꺼서 다음 주기부터 알림이 안 오게 함
  hktbRetainerAutoEnabled: boolean("hktbRetainerAutoEnabled").default(true).notNull(),
  // 재계약 시점(자동 알림을 다시 켤 때)마다 그 계약연도의 고정 월 관리비를 입력받아 저장
  hktbRetainerMonthlyPrice: varchar("hktbRetainerMonthlyPrice", { length: 20 }).default("850,000").notNull(),
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
  depositRatio: integer("depositRatio").default(50).notNull(),
  contactPhone: varchar("contactPhone", { length: 50 }).default("").notNull(),
  contactEmail: varchar("contactEmail", { length: 255 }).default("").notNull(),
  noContact: boolean("noContact").default(false).notNull(),
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

export interface SiteStructureEntry {
  id: string;
  menuStructure: { label: string; subItems: string[] }[];
  questions: string[];
  summary: string;
  generatedAt: string;
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
  memo: text("memo"),
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
  contactEmail: varchar("contactEmail", { length: 255 }).default("").notNull(),
  noContact: boolean("noContact").default(false).notNull(),
  businessNumber: varchar("businessNumber", { length: 50 })
    .default("")
    .notNull(),
  contractDate: varchar("contractDate", { length: 20 }).default("").notNull(),
  contractAmount: integer("contractAmount").default(0).notNull(),
  status: clientStatusEnum("status").default("상담").notNull(),
  memo: text("memo").default("").notNull(),
  siteStructures: json("siteStructures").$type<SiteStructureEntry[]>().default([]).notNull(),
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
  finalPaymentMemo: text("finalPaymentMemo"),
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
  memo: text("memo"),
  emailSentAt: timestamp("emailSentAt"),
  emailSentTo: varchar("emailSentTo", { length: 320 }),
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
  clientId: integer("clientId"),
  name: varchar("name", { length: 500 }).notNull(),
  fileSize: integer("fileSize").notNull(),
  data: text("data").notNull(),
  mimeType: varchar("mimeType", { length: 100 }).default("application/pdf").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PdfFile = typeof pdfFiles.$inferSelect;
export type InsertPdfFile = typeof pdfFiles.$inferInsert;

export const todoPriorityEnum = pgEnum("todo_priority", ["low", "medium", "high"]);

export const todos = pgTable("todos", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  content: text("content").notNull(),
  priority: todoPriorityEnum("priority").default("medium").notNull(),
  clientId: integer("clientId"),
  dueDate: varchar("dueDate", { length: 10 }), // "YYYY-MM-DD", 선택 입력 — 있으면 캘린더에도 표시됨
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => new Date()),
});

export type Todo = typeof todos.$inferSelect;
export type InsertTodo = typeof todos.$inferInsert;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: varchar("userAgent", { length: 500 }).default("").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// 웹 푸시 구독이 없는 클라이언트(예: 데스크탑 앱)도 폴링으로 받아갈 수 있도록 알림 이벤트를 별도로 기록
export const notificationEvents = pgTable("notification_events", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  url: varchar("url", { length: 500 }).default("/").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NotificationEvent = typeof notificationEvents.$inferSelect;
export type InsertNotificationEvent = typeof notificationEvents.$inferInsert;

// 상담/계약/시안/납품처럼 정해진 항목이 아닌, 미팅 등 자유롭게 등록하는 캘린더 일정
export const customEvents = pgTable("custom_events", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  date: varchar("date", { length: 20 }).notNull(),
  memo: text("memo").default("").notNull(),
  clientId: integer("clientId"),
  isMeeting: boolean("isMeeting").default(false).notNull(),
  time: varchar("time", { length: 10 }), // "HH:MM", 미팅이고 시간이 정해진 경우만
  timeUnknown: boolean("timeUnknown").default(false).notNull(), // 미팅인데 시간이 아직 미정인 경우
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomEvent = typeof customEvents.$inferSelect;
export type InsertCustomEvent = typeof customEvents.$inferInsert;

// 카드사 이용내역 엑셀에서 사용자가 "광고비"/"AI비용" 등으로 분류해서 저장하기로 고른 지출만 저장
// (엑셀 전체 내역이 아니라, 검토 후 카테고리를 지정한 항목만 들어옴)
export const cardTransactions = pgTable(
  "card_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    date: varchar("date", { length: 10 }).notNull(), // "YYYY-MM-DD"
    time: varchar("time", { length: 10 }).default("").notNull(), // "HH:MM:SS"
    merchant: varchar("merchant", { length: 300 }).notNull(),
    amount: doublePrecision("amount").notNull(), // 국내는 원(정수), 해외는 USD(소수 가능)
    currency: varchar("currency", { length: 10 }).default("KRW").notNull(), // "KRW" | "USD"
    installment: varchar("installment", { length: 20 }).default("").notNull(), // "일시불" / "할부"
    approvalNo: varchar("approvalNo", { length: 50 }).notNull(),
    category: varchar("category", { length: 30 }).notNull(), // "ad_spend" | "ai_cost"
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userApprovalUnique: unique().on(table.userId, table.approvalNo),
  })
);

export type CardTransaction = typeof cardTransactions.$inferSelect;
export type InsertCardTransaction = typeof cardTransactions.$inferInsert;

// 가맹점명 → 카테고리 매핑을 기억해서, 다음 달 업로드 때 같은 가맹점이 나오면 자동으로 미리 체크해줌
export const expenseMerchantRules = pgTable(
  "expense_merchant_rules",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    merchant: varchar("merchant", { length: 300 }).notNull(),
    category: varchar("category", { length: 30 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => new Date()),
  },
  (table) => ({
    userMerchantUnique: unique().on(table.userId, table.merchant),
  })
);

export type ExpenseMerchantRule = typeof expenseMerchantRules.$inferSelect;
export type InsertExpenseMerchantRule = typeof expenseMerchantRules.$inferInsert;

// 홈페이지 제작 관련, 고객에게 로그인 없이 링크로 보내서 답변받는 질문폼
export interface IntakeFormQuestion {
  text: string;
  required: boolean;
  type: "text" | "textarea" | "select";
  options?: string[]; // type이 "select"일 때만 사용
}

export const intakeForms = pgTable("intake_forms", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  clientId: integer("clientId").notNull(),
  token: varchar("token", { length: 40 }).notNull().unique(),
  questions: json("questions").$type<IntakeFormQuestion[]>().default([]).notNull(),
  answers: json("answers").$type<string[]>().default([]).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // "pending" | "submitted"
  shortLink: varchar("shortLink", { length: 200 }), // is.gd 등으로 단축된 주소 (실패 시 null, 이 경우 /f/:token 그대로 사용)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  submittedAt: timestamp("submittedAt"),
});

export type IntakeForm = typeof intakeForms.$inferSelect;
export type InsertIntakeForm = typeof intakeForms.$inferInsert;

export const clientEmails = pgTable("client_emails", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  clientId: integer("clientId").notNull(),
  toAddress: varchar("toAddress", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  channel: varchar("channel", { length: 10 }).default("email").notNull(), // "email" | "sms"
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export type ClientEmail = typeof clientEmails.$inferSelect;
export type InsertClientEmail = typeof clientEmails.$inferInsert;

// 고객 메일 수신 감지(Gmail API, gmail.metadata)에서 이미 알림 보낸 메일을 기록해 중복 알림을 막는다
export const gmailNotifiedMessages = pgTable("gmail_notified_messages", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  messageId: varchar("messageId", { length: 100 }).notNull().unique(),
  fromAddress: varchar("fromAddress", { length: 320 }).default("").notNull(),
  subject: varchar("subject", { length: 500 }).default("").notNull(),
  isClientEmail: boolean("isClientEmail").default(false).notNull(),
  clientName: varchar("clientName", { length: 500 }),
  notifiedAt: timestamp("notifiedAt").defaultNow().notNull(),
});

export type GmailNotifiedMessage = typeof gmailNotifiedMessages.$inferSelect;
