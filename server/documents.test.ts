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
  // In-memory store for testing
  let docs: Array<{
    id: number;
    userId: number;
    type: "proposal" | "estimate";
    title: string;
    memo: string | null;
    clientName: string;
    projectName: string;
    platform: string;
    date: string;
    items: Array<{ id: string; name: string; quantity: string; originalPrice: string; discountPrice: string }>;
    notes: string[];
    totalMin: number;
    totalMax: number;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  let nextId = 1;

  return {
    listDocuments: vi.fn(async (userId: number, type?: "proposal" | "estimate") => {
      return docs
        .filter((d) => d.userId === userId && (!type || d.type === type))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }),
    getDocument: vi.fn(async (id: number, userId: number) => {
      return docs.find((d) => d.id === id && d.userId === userId) || undefined;
    }),
    createDocument: vi.fn(async (data: Record<string, unknown>) => {
      const doc = {
        id: nextId++,
        userId: data.userId as number,
        type: data.type as "proposal" | "estimate",
        title: (data.title as string) || "",
        memo: (data.memo as string | null) || null,
        clientName: (data.clientName as string) || "",
        projectName: (data.projectName as string) || "",
        platform: (data.platform as string) || "",
        date: (data.date as string) || "",
        items: (data.items as Array<{ id: string; name: string; quantity: string; originalPrice: string; discountPrice: string }>) || [],
        notes: (data.notes as string[]) || [],
        totalMin: (data.totalMin as number) || 0,
        totalMax: (data.totalMax as number) || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      docs.push(doc);
      return doc;
    }),
    updateDocument: vi.fn(async (id: number, userId: number, data: Record<string, unknown>) => {
      const idx = docs.findIndex((d) => d.id === id && d.userId === userId);
      if (idx === -1) return undefined;
      docs[idx] = { ...docs[idx], ...data, updatedAt: new Date() };
      return docs[idx];
    }),
    deleteDocument: vi.fn(async (id: number, userId: number) => {
      const idx = docs.findIndex((d) => d.id === id && d.userId === userId);
      if (idx !== -1) docs.splice(idx, 1);
      return { success: true };
    }),
    // Reset helper for tests
    _reset: () => {
      docs = [];
      nextId = 1;
    },
    // Re-export other db functions that might be needed
    upsertUser: vi.fn(),
    findUserByOpenId: vi.fn(),
  };
});

// Import the mocked db to access _reset
import * as db from "./db";

beforeEach(() => {
  (db as unknown as { _reset: () => void })._reset();
});

describe("documents.create", () => {
  it("creates a new proposal document", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.documents.create({
      type: "proposal",
      title: "테스트 제안서",
      clientName: "테스트 고객사",
      projectName: "홈페이지 리뉴얼",
      platform: "아임웹",
      date: "2026-03-25",
      items: [
        { id: "item-1", name: "메인 페이지", quantity: "1페이지", originalPrice: "900,000", discountPrice: "" },
      ],
      notes: ["본 견적은 대략적인 예상 금액입니다."],
      totalMin: 2000000,
      totalMax: 2500000,
    });

    expect(result).toBeDefined();
    expect(result!.type).toBe("proposal");
    expect(result!.title).toBe("테스트 제안서");
    expect(result!.clientName).toBe("테스트 고객사");
    expect(result!.userId).toBe(1);
  });

  it("creates a new estimate document", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.documents.create({
      type: "estimate",
      title: "테스트 견적서",
      clientName: "견적 고객사",
      projectName: "앱 개발",
      platform: "",
      date: "2026-03-25",
      items: [],
      notes: [],
      totalMin: 5000000,
      totalMax: 5000000,
    });

    expect(result).toBeDefined();
    expect(result!.type).toBe("estimate");
    expect(result!.totalMin).toBe(5000000);
  });
});

describe("documents.list", () => {
  it("lists all documents for the authenticated user", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    // Create two documents
    await caller.documents.create({
      type: "proposal",
      title: "제안서 1",
      items: [],
      notes: [],
    });
    await caller.documents.create({
      type: "estimate",
      title: "견적서 1",
      items: [],
      notes: [],
    });

    const result = await caller.documents.list();
    expect(result).toHaveLength(2);
  });

  it("filters documents by type", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    await caller.documents.create({ type: "proposal", title: "제안서", items: [], notes: [] });
    await caller.documents.create({ type: "estimate", title: "견적서", items: [], notes: [] });

    const proposals = await caller.documents.list({ type: "proposal" });
    expect(proposals).toHaveLength(1);
    expect(proposals[0].type).toBe("proposal");

    const estimates = await caller.documents.list({ type: "estimate" });
    expect(estimates).toHaveLength(1);
    expect(estimates[0].type).toBe("estimate");
  });

  it("does not return documents from other users", async () => {
    const ctx1 = createAuthContext(1);
    const ctx2 = createAuthContext(2);
    const caller1 = appRouter.createCaller(ctx1);
    const caller2 = appRouter.createCaller(ctx2);

    await caller1.documents.create({ type: "proposal", title: "User1 제안서", items: [], notes: [] });
    await caller2.documents.create({ type: "proposal", title: "User2 제안서", items: [], notes: [] });

    const user1Docs = await caller1.documents.list();
    expect(user1Docs).toHaveLength(1);
    expect(user1Docs[0].title).toBe("User1 제안서");

    const user2Docs = await caller2.documents.list();
    expect(user2Docs).toHaveLength(1);
    expect(user2Docs[0].title).toBe("User2 제안서");
  });
});

describe("documents.get", () => {
  it("returns a document by ID for the owner", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const created = await caller.documents.create({
      type: "proposal",
      title: "조회 테스트",
      items: [],
      notes: [],
    });

    const result = await caller.documents.get({ id: created!.id });
    expect(result).toBeDefined();
    expect(result.title).toBe("조회 테스트");
  });

  it("throws error when document not found", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.documents.get({ id: 9999 })).rejects.toThrow("Document not found");
  });

  it("throws error when accessing another user's document", async () => {
    const ctx1 = createAuthContext(1);
    const ctx2 = createAuthContext(2);
    const caller1 = appRouter.createCaller(ctx1);
    const caller2 = appRouter.createCaller(ctx2);

    const created = await caller1.documents.create({
      type: "proposal",
      title: "User1 문서",
      items: [],
      notes: [],
    });

    await expect(caller2.documents.get({ id: created!.id })).rejects.toThrow("Document not found");
  });
});

describe("documents.update", () => {
  it("updates a document's fields", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const created = await caller.documents.create({
      type: "proposal",
      title: "원래 제목",
      clientName: "원래 고객",
      items: [],
      notes: [],
    });

    const updated = await caller.documents.update({
      id: created!.id,
      data: {
        title: "수정된 제목",
        clientName: "수정된 고객",
        totalMin: 3000000,
      },
    });

    expect(updated).toBeDefined();
    expect(updated!.title).toBe("수정된 제목");
    expect(updated!.clientName).toBe("수정된 고객");
  });

  it("throws error when updating another user's document", async () => {
    const ctx1 = createAuthContext(1);
    const ctx2 = createAuthContext(2);
    const caller1 = appRouter.createCaller(ctx1);
    const caller2 = appRouter.createCaller(ctx2);

    const created = await caller1.documents.create({
      type: "proposal",
      title: "User1 문서",
      items: [],
      notes: [],
    });

    await expect(
      caller2.documents.update({
        id: created!.id,
        data: { title: "해킹 시도" },
      })
    ).rejects.toThrow();
  });
});

describe("documents.delete", () => {
  it("deletes a document owned by the user", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const created = await caller.documents.create({
      type: "estimate",
      title: "삭제 테스트",
      items: [],
      notes: [],
    });

    const result = await caller.documents.delete({ id: created!.id });
    expect(result).toEqual({ success: true });

    // Verify it's gone
    const list = await caller.documents.list();
    expect(list).toHaveLength(0);
  });
});

describe("documents - unauthenticated access", () => {
  it("rejects unauthenticated list request", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.documents.list()).rejects.toThrow();
  });

  it("rejects unauthenticated create request", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.documents.create({
        type: "proposal",
        title: "불법 접근",
        items: [],
        notes: [],
      })
    ).rejects.toThrow();
  });
});
