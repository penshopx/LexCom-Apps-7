/**
 * Rate-limit SSE handling tests
 *
 * Verifies that when OpenAI returns a 429 (rate limit) — after all retries are
 * exhausted by batchProcess — every affected agent route emits a structured
 * { error: "..." } event over the SSE channel rather than hanging or emitting
 * a silent empty response.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express, { type Application } from "express";

// ─── Shared mocks ────────────────────────────────────────────────────────────

const rateLimitError = Object.assign(new Error("429 Too Many Requests"), {
  status: 429,
});

/** Controls whether batchProcess should succeed or fail. */
let batchShouldFail = true;
/** When not failing, the value batchProcess resolves with. */
let batchResolveWith: unknown = null;

vi.mock("@workspace/integrations-openai-ai-server/batch", () => ({
  batchProcess: vi.fn().mockImplementation(async () => {
    if (batchShouldFail) throw rateLimitError;
    return [batchResolveWith];
  }),
  limitAiRequest: vi.fn().mockImplementation(async (operation: () => Promise<unknown>) => operation()),
  isRateLimitError: vi.fn().mockImplementation((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes("429") || msg.toLowerCase().includes("rate limit");
  }),
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
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

// ─── Database mock helpers ────────────────────────────────────────────────────

const mockConv = { id: 1, agentType: "corporate", userId: null, title: "Test" };
const mockMsgs = [
  { id: 1, conversationId: 1, role: "user", content: "hello", createdAt: new Date() },
];

/** Build a chainable drizzle-style mock that resolves to the given value. */
function makeSelectMock(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
    // When .where() is awaited directly (no .orderBy() call)
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

vi.mock("@workspace/db", () => {
  // selectCall tracks invocation order so we can return different data for
  // the conversation lookup vs. the message history lookup.
  let selectCall = 0;
  return {
    db: {
      select: vi.fn().mockImplementation(() => {
        selectCall++;
        if (selectCall % 2 === 1) {
          // Odd calls → conversation lookup (returns without .orderBy)
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([mockConv]),
            }),
          };
        }
        // Even calls → message history lookup (requires .orderBy)
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockMsgs),
            }),
          }),
        };
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockConv]),
        }),
      }),
    },
    conversations: {},
    messages: {},
    eq: vi.fn(),
    asc: vi.fn(),
  };
});

vi.mock("@workspace/api-zod", () => ({
  CreateOpenaiConversationBody: {
    parse: (v: unknown) => v,
  },
  SendOpenaiMessageBody: {
    parse: (v: unknown) => v,
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse SSE text into an array of parsed JSON objects. */
function parseSseEvents(text: string): Record<string, unknown>[] {
  return text
    .split("\n")
    .filter((l) => l.startsWith("data: "))
    .map((l) => {
      try { return JSON.parse(l.slice(6)); } catch { return null; }
    })
    .filter(Boolean) as Record<string, unknown>[];
}

/** Create a minimal express app containing just the given router. */
function buildApp(router: express.Router): Application {
  const app = express();
  app.use(express.json());
  // Attach a no-op logger so req.log.error() doesn't crash.
  // Cast to `any` because pino-http augments Request.log with a specific type
  // that differs from our stub; using any avoids a brittle type coupling here.
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).log = {
      error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(),
    };
    next();
  });
  app.use("/api", router);
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("rate-limit SSE error events — /api/openai route", () => {
  let app: Application;

  beforeEach(async () => {
    batchShouldFail = true;
    vi.resetModules();
    const { default: openaiRouter } = await import("./openai");
    app = buildApp(openaiRouter);
  });

  it("emits { error } SSE event when stream creation hits rate limit", async () => {
    const res = await request(app)
      .post("/api/openai/conversations/1/messages")
      .send({ content: "Apa itu pasal 1365 KUHPerdata?" })
      .buffer(true)
      .parse((res, cb) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => cb(null, data));
      });

    const events = parseSseEvents(res.body as string);
    const errorEvent = events.find((e) => "error" in e);

    expect(errorEvent).toBeDefined();
    expect(typeof errorEvent!.error).toBe("string");
    // Should mention rate limit in Indonesian
    expect((errorEvent!.error as string).toLowerCase()).toMatch(/batas|rate/i);
  });
});

describe("empty AI response handling — /api/openai route", () => {
  let app: Application;

  beforeEach(async () => {
    batchShouldFail = false;
    batchResolveWith = {
      async *[Symbol.asyncIterator]() {
        // The provider completes successfully but never emits content.
      },
    };
    vi.resetModules();
    const { default: openaiRouter } = await import("./openai");
    app = buildApp(openaiRouter);
  });

  it("emits a retryable error instead of saving an empty assistant message", async () => {
    const res = await request(app)
      .post("/api/openai/conversations/1/messages")
      .send({ content: "Jelaskan wanprestasi" })
      .buffer(true)
      .parse((stream, cb) => {
        let data = "";
        stream.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        stream.on("end", () => cb(null, data));
      });

    const events = parseSseEvents(res.body as string);
    const errorEvent = events.find((event) => event.type === "error");

    expect(errorEvent).toMatchObject({
      type: "error",
      retryable: true,
    });
    expect(errorEvent?.message).toMatch(/tidak menghasilkan jawaban/i);
    expect(events.some((event) => event.done === true)).toBe(false);
  });
});

describe("rate-limit SSE error events — /api/assistant route", () => {
  let app: Application;

  beforeEach(async () => {
    batchShouldFail = true;
    vi.resetModules();
    const { default: assistantRouter } = await import("./assistant");
    app = buildApp(assistantRouter);
  });

  it("emits { type: 'error' } SSE event when orchestrator hits rate limit", async () => {
    const res = await request(app)
      .post("/api/assistant/conversations/1/chat")
      .send({ content: "Apa itu PKPU?" })
      .buffer(true)
      .parse((res, cb) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => cb(null, data));
      });

    const events = parseSseEvents(res.body as string);
    const errorEvent = events.find((e) => e.type === "error");

    expect(errorEvent).toBeDefined();
    expect(typeof errorEvent!.message).toBe("string");
    expect((errorEvent!.message as string).toLowerCase()).toMatch(/batas|rate/i);
  });
});

describe("rate-limit SSE error events — /api/agentic route", () => {
  let app: Application;

  beforeEach(async () => {
    batchShouldFail = true;
    vi.resetModules();
    const { default: agenticRouter } = await import("./agentic");
    app = buildApp(agenticRouter);
  });

  it("emits { type: 'error' } SSE event when orchestrator hits rate limit (manual mode)", async () => {
    // Use forcedAgents so the orchestrator call is skipped; batchProcess is
    // invoked when the first agent stream is created.
    const res = await request(app)
      .post("/api/agentic/conversations/1/chat")
      .send({ content: "Apa itu PHK?", forcedAgents: ["employment"] })
      .buffer(true)
      .parse((res, cb) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => cb(null, data));
      });

    const events = parseSseEvents(res.body as string);
    const errorEvent = events.find((e) => e.type === "error");

    expect(errorEvent).toBeDefined();
    expect(typeof errorEvent!.message).toBe("string");
    expect((errorEvent!.message as string).toLowerCase()).toMatch(/batas|rate/i);
  });
});

describe("rate-limit SSE error events — /api/documents route", () => {
  let app: Application;

  beforeEach(async () => {
    batchShouldFail = true;
    vi.resetModules();
    const { default: documentsRouter } = await import("./documents");
    app = buildApp(documentsRouter);
  });

  it("emits { error } SSE event when document generation hits rate limit", async () => {
    const res = await request(app)
      .post("/api/documents/generate")
      .send({ documentType: "kontrak", description: "Kontrak jual beli tanah" })
      .buffer(true)
      .parse((res, cb) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => cb(null, data));
      });

    const events = parseSseEvents(res.body as string);
    const errorEvent = events.find((e) => "error" in e);

    expect(errorEvent).toBeDefined();
    expect(typeof errorEvent!.error).toBe("string");
    expect((errorEvent!.error as string).toLowerCase()).toMatch(/batas|rate/i);
  });
});
