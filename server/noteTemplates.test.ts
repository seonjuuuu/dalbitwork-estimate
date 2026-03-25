import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// Mock the db module
vi.mock("./db", () => {
  // In-memory stores
  let templates: Array<{
    id: number;
    userId: number;
    name: string;
    notes: string[];
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  let nextTemplateId = 1;

  let docs: Array<Record<string, unknown>> = [];
  let nextDocId = 1;

  return {
    // Note template CRUD
    listNoteTemplates: vi.fn(async (userId: number) => {
      return templates
        .filter((t) => t.userId === userId)
        .sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.getTime() - a.createdAt.getTime());
    }),
    getNoteTemplate: vi.fn(async (id: number, userId: number) => {
      return templates.find((t) => t.id === id && t.userId === userId) || undefined;
    }),
    createNoteTemplate: vi.fn(async (data: Record<string, unknown>) => {
      const tmpl = {
        id: nextTemplateId++,
        userId: data.userId as number,
        name: data.name as string,
        notes: data.notes as string[],
        sortOrder: (data.sortOrder as number) || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      templates.push(tmpl);
      return tmpl;
    }),
    updateNoteTemplate: vi.fn(async (id: number, userId: number, data: Record<string, unknown>) => {
      const idx = templates.findIndex((t) => t.id === id && t.userId === userId);
      if (idx === -1) return undefined;
      templates[idx] = { ...templates[idx], ...data, updatedAt: new Date() };
      return templates[idx];
    }),
    deleteNoteTemplate: vi.fn(async (id: number, userId: number) => {
      const idx = templates.findIndex((t) => t.id === id && t.userId === userId);
      if (idx !== -1) templates.splice(idx, 1);
      return { success: true };
    }),

    // Document CRUD (needed because routers.ts imports all db functions)
    listDocuments: vi.fn(async () => []),
    getDocument: vi.fn(async () => undefined),
    createDocument: vi.fn(async (data: Record<string, unknown>) => {
      const doc = { id: nextDocId++, ...data, createdAt: new Date(), updatedAt: new Date() };
      docs.push(doc);
      return doc;
    }),
    updateDocument: vi.fn(async () => undefined),
    deleteDocument: vi.fn(async () => ({ success: true })),

    // Other db functions
    upsertUser: vi.fn(),
    findUserByOpenId: vi.fn(),

    // Reset helper
    _reset: () => {
      templates = [];
      nextTemplateId = 1;
      docs = [];
      nextDocId = 1;
    },
  };
});

import * as db from "./db";

beforeEach(() => {
  (db as unknown as { _reset: () => void })._reset();
});

describe("noteTemplates.create", () => {
  it("creates a new note template", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.noteTemplates.create({
      name: "기본 계약 조항",
      notes: [
        "계약서 내용을 확인하시고 계약금 입금시 본 계약서의 효력이 발생합니다.",
        "수정은 작업완료 후 3회까지 무료로 진행합니다.",
      ],
    });

    expect(result).toBeDefined();
    expect(result!.name).toBe("기본 계약 조항");
    expect(result!.notes).toHaveLength(2);
    expect(result!.userId).toBe(1);
  });

  it("creates a template with custom sortOrder", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.noteTemplates.create({
      name: "우선순위 높은 템플릿",
      notes: ["첫 번째 항목"],
      sortOrder: 10,
    });

    expect(result).toBeDefined();
    expect(result!.sortOrder).toBe(10);
  });
});

describe("noteTemplates.list", () => {
  it("lists all templates for the authenticated user", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    await caller.noteTemplates.create({
      name: "템플릿 1",
      notes: ["항목 1"],
    });
    await caller.noteTemplates.create({
      name: "템플릿 2",
      notes: ["항목 2"],
    });

    const result = await caller.noteTemplates.list();
    expect(result).toHaveLength(2);
  });

  it("does not return templates from other users", async () => {
    const ctx1 = createAuthContext(1);
    const ctx2 = createAuthContext(2);
    const caller1 = appRouter.createCaller(ctx1);
    const caller2 = appRouter.createCaller(ctx2);

    await caller1.noteTemplates.create({ name: "User1 템플릿", notes: ["항목"] });
    await caller2.noteTemplates.create({ name: "User2 템플릿", notes: ["항목"] });

    const user1Templates = await caller1.noteTemplates.list();
    expect(user1Templates).toHaveLength(1);
    expect(user1Templates[0].name).toBe("User1 템플릿");

    const user2Templates = await caller2.noteTemplates.list();
    expect(user2Templates).toHaveLength(1);
    expect(user2Templates[0].name).toBe("User2 템플릿");
  });
});

describe("noteTemplates.get", () => {
  it("returns a template by ID for the owner", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const created = await caller.noteTemplates.create({
      name: "조회 테스트",
      notes: ["항목 1", "항목 2"],
    });

    const result = await caller.noteTemplates.get({ id: created!.id });
    expect(result).toBeDefined();
    expect(result.name).toBe("조회 테스트");
    expect(result.notes).toHaveLength(2);
  });

  it("throws error when template not found", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.noteTemplates.get({ id: 9999 })).rejects.toThrow("Template not found");
  });

  it("throws error when accessing another user's template", async () => {
    const ctx1 = createAuthContext(1);
    const ctx2 = createAuthContext(2);
    const caller1 = appRouter.createCaller(ctx1);
    const caller2 = appRouter.createCaller(ctx2);

    const created = await caller1.noteTemplates.create({
      name: "User1 전용",
      notes: ["비밀 항목"],
    });

    await expect(caller2.noteTemplates.get({ id: created!.id })).rejects.toThrow("Template not found");
  });
});

describe("noteTemplates.update", () => {
  it("updates a template's name and notes", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const created = await caller.noteTemplates.create({
      name: "원래 이름",
      notes: ["원래 항목"],
    });

    const updated = await caller.noteTemplates.update({
      id: created!.id,
      data: {
        name: "수정된 이름",
        notes: ["수정된 항목 1", "수정된 항목 2"],
      },
    });

    expect(updated).toBeDefined();
    expect(updated!.name).toBe("수정된 이름");
    expect(updated!.notes).toHaveLength(2);
  });

  it("throws error when updating another user's template", async () => {
    const ctx1 = createAuthContext(1);
    const ctx2 = createAuthContext(2);
    const caller1 = appRouter.createCaller(ctx1);
    const caller2 = appRouter.createCaller(ctx2);

    const created = await caller1.noteTemplates.create({
      name: "User1 템플릿",
      notes: ["항목"],
    });

    await expect(
      caller2.noteTemplates.update({
        id: created!.id,
        data: { name: "해킹 시도" },
      })
    ).rejects.toThrow();
  });
});

describe("noteTemplates.delete", () => {
  it("deletes a template owned by the user", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const created = await caller.noteTemplates.create({
      name: "삭제 테스트",
      notes: ["항목"],
    });

    const result = await caller.noteTemplates.delete({ id: created!.id });
    expect(result).toEqual({ success: true });

    const list = await caller.noteTemplates.list();
    expect(list).toHaveLength(0);
  });
});

describe("noteTemplates.saveFromDocument", () => {
  it("saves current document notes as a new template", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.noteTemplates.saveFromDocument({
      name: "문서에서 저장",
      notes: [
        "계약금 입금시 계약이 확정됩니다.",
        "수정은 3회까지 무료입니다.",
        "작업 완료 후 추가 수정은 유료입니다.",
      ],
    });

    expect(result).toBeDefined();
    expect(result!.name).toBe("문서에서 저장");
    expect(result!.notes).toHaveLength(3);
  });
});

describe("noteTemplates - unauthenticated access", () => {
  it("rejects unauthenticated list request", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.noteTemplates.list()).rejects.toThrow();
  });

  it("rejects unauthenticated create request", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.noteTemplates.create({
        name: "불법 접근",
        notes: ["항목"],
      })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated delete request", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.noteTemplates.delete({ id: 1 })).rejects.toThrow();
  });
});
