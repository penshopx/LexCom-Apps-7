/**
 * Agentic conversation auth integration tests
 *
 * Verifies that:
 * 1. GET /agentic/conversations returns only the authenticated user's conversations
 *    (empty array when unauthenticated).
 * 2. GET /agentic/conversations/:id/messages enforces ownership:
 *    - 200 for the owning user
 *    - 401 for unowned legacy conversations (userId=null)
 *    - 403 when a different authenticated user requests another user's conversation
 * 3. POST /agentic/conversations/:id/chat enforces ownership:
 *    - 403 when a different user attempts to use another user's conversation
 *
 * These tests inject req.user directly to isolate route logic from the
 * OIDC/session infrastructure. The mobile client passes the server session ID
 * as an Authorization: Bearer header; authMiddleware resolves that session ID
 * to req.user before these routes run.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express, { type Application, type Request, type Response, type NextFunction } from "express";

// ─── Shared mocks ─────────────────────────────────────────────────────────────

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

vi.mock("@workspace/integrations-openai-ai-server/batch", () => ({
  batchProcess: vi.fn().mockResolvedValue([null]),
  isRateLimitError: vi.fn().mockReturnValue(false),
}));

vi.mock("pino-http", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    fatal: vi.fn(), trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

// ─── Database mock state ──────────────────────────────────────────────────────

interface MockConv {
  id: number;
  userId: string | null;
  title: string;
  agentType: string;
  createdAt: Date;
}

/** Controls which conversation the DB returns for a lookup by ID. */
let mockConvForId: MockConv | null = null;
/** Controls which conversations the DB returns for a list query. */
let mockConvList: MockConv[] = [];

vi.mock("@workspace/db", () => {
  return {
    db: {
      select: vi.fn().mockImplementation(() => {
        const chainForList = {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockConvList)),
            }),
          }),
        };

        const chainForSingle = {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() =>
              Promise.resolve(mockConvForId ? [mockConvForId] : [])
            ),
          }),
        };

        // Use the single-result chain for the conversation lookup (no orderBy),
        // and the list chain for ordered selects. Since the list endpoint calls
        // .orderBy(), and the single-lookup (ownership check) just awaits .where(),
        // we can distinguish them by checking if the caller chain ends in orderBy.
        return {
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => {
              const result = mockConvForId ? [mockConvForId] : [];
              const withOrderBy = {
                orderBy: vi.fn().mockImplementation(() => Promise.resolve(mockConvList)),
                then: (resolve: (v: unknown[]) => void) => resolve(result),
              };
              return withOrderBy;
            }),
          })),
        };
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 42, userId: "user-1", title: "Test", agentType: "agentic", createdAt: new Date() }]),
        }),
      }),
    },
    conversations: { userId: "userId_col" },
    messages: { conversationId: "conversationId_col" },
    eq: vi.fn(),
    asc: vi.fn(),
    desc: vi.fn(),
  };
});

// ─── Test app builder ─────────────────────────────────────────────────────────

interface FakeUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

/**
 * Build a minimal Express app around the agentic router.
 * If `user` is provided, it is set on req.user (simulating a successful
 * session lookup from the auth middleware, which the mobile client triggers
 * by sending Authorization: Bearer <session-id>).
 */
function buildApp(user?: FakeUser): Application {
  const app = express();
  app.use(express.json());
  // Simulate authMiddleware populating req.user
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (user) {
      (req as Request & { user?: FakeUser }).user = user;
    }
    req.isAuthenticated = function (this: Request): this is Express.AuthedRequest {
      return user != null;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).log = {
      error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(),
    };
    next();
  });
  return app;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/agentic/conversations — conversation list auth", () => {
  let router: express.Router;

  beforeEach(async () => {
    vi.resetModules();
    mockConvList = [];
    mockConvForId = null;
    const mod = await import("./agentic");
    router = mod.default as unknown as express.Router;
  });

  it("returns 401 for an unauthenticated request (no Bearer token)", async () => {
    const app = buildApp(/* no user */);
    app.use("/api", router);

    const res = await request(app).get("/api/agentic/conversations");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Authentication required" });
  });

  it("returns the authenticated user's conversations", async () => {
    const user: FakeUser = { id: "user-1", email: null, firstName: null, lastName: null, profileImageUrl: null };
    const conv: MockConv = { id: 1, userId: "user-1", title: "PT question", agentType: "agentic", createdAt: new Date() };
    mockConvList = [conv];

    const app = buildApp(user);
    app.use("/api", router);

    const res = await request(app).get("/api/agentic/conversations");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // The list endpoint returns the DB result which should include our mock conv
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("PT question");
  });
});

describe("GET /api/agentic/conversations/:id/messages — ownership enforcement", () => {
  let router: express.Router;

  beforeEach(async () => {
    vi.resetModules();
    mockConvList = [];
    mockConvForId = null;
    const mod = await import("./agentic");
    router = mod.default as unknown as express.Router;
  });

  it("returns 401 for an unowned legacy conversation without auth (userId=null)", async () => {
    mockConvForId = { id: 5, userId: null, title: "Anon chat", agentType: "agentic", createdAt: new Date() };

    const app = buildApp(/* no user */);
    app.use("/api", router);

    const res = await request(app).get("/api/agentic/conversations/5/messages");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Authentication required" });
  });

  it("returns 403 when the conversation has no owner", async () => {
    const user: FakeUser = { id: "user-1", email: null, firstName: null, lastName: null, profileImageUrl: null };
    mockConvForId = { id: 6, userId: null, title: "Legacy chat", agentType: "agentic", createdAt: new Date() };

    const app = buildApp(user);
    app.use("/api", router);

    const res = await request(app).get("/api/agentic/conversations/6/messages");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "Forbidden" });
  });

  it("returns 200 when the authenticated user owns the conversation", async () => {
    const user: FakeUser = { id: "user-1", email: null, firstName: null, lastName: null, profileImageUrl: null };
    mockConvForId = { id: 7, userId: "user-1", title: "My chat", agentType: "agentic", createdAt: new Date() };

    const app = buildApp(user);
    app.use("/api", router);

    const res = await request(app).get("/api/agentic/conversations/7/messages");

    expect(res.status).toBe(200);
  });

  it("returns 403 when an authenticated user requests another user's conversation", async () => {
    const user: FakeUser = { id: "user-2", email: null, firstName: null, lastName: null, profileImageUrl: null };
    mockConvForId = { id: 9, userId: "user-1", title: "Other's chat", agentType: "agentic", createdAt: new Date() };

    const app = buildApp(user);
    app.use("/api", router);

    const res = await request(app).get("/api/agentic/conversations/9/messages");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "Forbidden" });
  });

  it("returns 404 for a non-existent conversation", async () => {
    mockConvForId = null; // DB returns empty
    const user: FakeUser = { id: "user-1", email: null, firstName: null, lastName: null, profileImageUrl: null };

    const app = buildApp(user);
    app.use("/api", router);

    const res = await request(app).get("/api/agentic/conversations/999/messages");

    expect(res.status).toBe(404);
  });

  it("returns 401 before looking up a non-existent conversation when unauthenticated", async () => {
    mockConvForId = null;

    const app = buildApp();
    app.use("/api", router);

    const res = await request(app).get("/api/agentic/conversations/999/messages");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Authentication required" });
  });
});

describe("POST /api/agentic/conversations/:id/chat — ownership enforcement", () => {
  let router: express.Router;

  beforeEach(async () => {
    vi.resetModules();
    mockConvList = [];
    mockConvForId = null;
    const mod = await import("./agentic");
    router = mod.default as unknown as express.Router;
  });

  it("returns 403 when a different authenticated user attempts to chat in another user's conversation", async () => {
    const interloper: FakeUser = { id: "user-evil", email: null, firstName: null, lastName: null, profileImageUrl: null };
    mockConvForId = { id: 10, userId: "user-1", title: "Victim chat", agentType: "agentic", createdAt: new Date() };

    const app = buildApp(interloper);
    app.use("/api", router);

    const res = await request(app)
      .post("/api/agentic/conversations/10/chat")
      .send({ content: "Halo!" });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "Forbidden" });
  });

  it("returns 404 for a non-existent conversation", async () => {
    mockConvForId = null;
    const user: FakeUser = { id: "user-1", email: null, firstName: null, lastName: null, profileImageUrl: null };

    const app = buildApp(user);
    app.use("/api", router);

    const res = await request(app)
      .post("/api/agentic/conversations/999/chat")
      .send({ content: "Halo!" });

    expect(res.status).toBe(404);
  });

  it("returns 401 before validating a malformed chat body when unauthenticated", async () => {
    mockConvForId = { id: 11, userId: null, title: "Legacy", agentType: "agentic", createdAt: new Date() };

    const app = buildApp();
    app.use("/api", router);

    const res = await request(app)
      .post("/api/agentic/conversations/11/chat")
      .send({ content: "   " });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Authentication required" });
  });

  it("returns 401 before looking up a non-existent conversation when unauthenticated", async () => {
    mockConvForId = null;

    const app = buildApp();
    app.use("/api", router);

    const res = await request(app)
      .post("/api/agentic/conversations/999/chat")
      .send({ content: "Halo!" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Authentication required" });
  });
});
