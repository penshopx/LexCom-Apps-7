import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Application } from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  batchProcess: vi.fn(),
  createCompletion: vi.fn(),
  dbSelectCall: 0,
  insertedValues: [] as Array<Record<string, unknown>>,
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: mocks.createCompletion,
      },
    },
  },
}));

vi.mock("@workspace/integrations-openai-ai-server/batch", () => ({
  batchProcess: mocks.batchProcess,
  limitAiRequest: vi.fn(async (operation: () => Promise<unknown>) => operation()),
  isRateLimitError: vi.fn((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("429") || message.toLowerCase().includes("rate limit");
  }),
}));

const conversation = {
  id: 1,
  agentType: "agentic",
  userId: "user-1",
  title: "Resilience test",
};

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => {
      mocks.dbSelectCall++;
      if (mocks.dbSelectCall % 2 === 1) {
        return {
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([conversation]),
          })),
        };
      }
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([]),
          })),
        })),
      };
    }),
    insert: vi.fn(() => ({
      values: vi.fn((value: Record<string, unknown>) => {
        mocks.insertedValues.push(value);
        return {
          returning: vi.fn().mockResolvedValue([conversation]),
        };
      }),
    })),
  },
  conversations: {},
  messages: {},
}));

function buildApp(router: express.Router): Application {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: "user-1",
      email: null,
      firstName: null,
      lastName: null,
      profileImageUrl: null,
    };
    req.log = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as never;
    next();
  });
  app.use("/api", router);
  return app;
}

function parseSseEvents(text: string): Record<string, unknown>[] {
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>);
}

async function postChat(
  app: Application,
  body: { content: string; forcedAgents?: string[] },
) {
  return request(app)
    .post("/api/agentic/conversations/1/chat")
    .send(body)
    .buffer(true)
    .parse((stream, callback) => {
      let data = "";
      stream.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });
      stream.on("end", () => callback(null, data));
    });
}

function completionStream(...parts: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const content of parts) {
        yield { choices: [{ delta: { content } }] };
      }
    },
  };
}

function interruptedCompletionStream(content: string, error: Error) {
  return {
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content } }] };
      throw error;
    },
  };
}

describe("agentic SSE resilience", () => {
  let app: Application;

  beforeEach(async () => {
    vi.resetModules();
    mocks.createCompletion.mockReset();
    mocks.batchProcess.mockReset();
    mocks.dbSelectCall = 0;
    mocks.insertedValues.length = 0;

    mocks.batchProcess.mockImplementation(
      async (
        items: unknown[],
        processor: (item: unknown, index: number) => Promise<unknown>,
        options: { retries?: number } = {},
      ) => {
        let lastError: unknown;
        for (let attempt = 0; attempt <= (options.retries ?? 0); attempt++) {
          try {
            return [await processor(items[0], 0)];
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError;
      },
    );

    const { default: agenticRouter } = await import("./agentic");
    app = buildApp(agenticRouter);
  });

  it("retries a non-streaming orchestrator 429 and ends with an SSE error", async () => {
    mocks.createCompletion.mockRejectedValue(
      Object.assign(new Error("429 Too Many Requests"), { status: 429 }),
    );

    const response = await postChat(app, {
      content: "Analisis risiko hukum transaksi ini",
    });
    const events = parseSseEvents(response.body as string);

    expect(mocks.createCompletion).toHaveBeenCalledTimes(6);
    expect(mocks.batchProcess).toHaveBeenCalledWith(
      [null],
      expect.any(Function),
      expect.objectContaining({ retries: 5 }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "error",
        message: expect.stringMatching(/batas permintaan/i),
      }),
    );
    expect(events.some((event) => event.type === "done")).toBe(false);
  });

  it("recovers when the non-streaming orchestrator succeeds after transient 429s", async () => {
    let orchestratorAttempts = 0;
    mocks.createCompletion.mockImplementation(
      async (params: { stream?: boolean }) => {
        if (!params.stream) {
          orchestratorAttempts++;
          if (orchestratorAttempts < 3) {
            throw Object.assign(new Error("429 Too Many Requests"), {
              status: 429,
            });
          }
          return {
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      type: "function",
                      function: {
                        arguments: JSON.stringify({
                          agents: ["employment"],
                          mode: "single",
                          reasoning: "Pertanyaan berfokus pada ketenagakerjaan",
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          };
        }
        return completionStream("Telaah selesai.");
      },
    );

    const response = await postChat(app, {
      content: "Tinjau klausul PHK ini",
    });
    const events = parseSseEvents(response.body as string);

    expect(orchestratorAttempts).toBe(3);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "agents_selected",
        mode: "single",
      }),
    );
    expect(events).toContainEqual({
      type: "agent_done",
      agent: "employment",
    });
    expect(events).toContainEqual({ type: "done" });
    expect(events.some((event) => event.type === "error")).toBe(false);
  });

  it("retries a streaming specialist 429 and reports a terminal SSE error", async () => {
    mocks.createCompletion.mockRejectedValue(
      Object.assign(new Error("429 Too Many Requests"), { status: 429 }),
    );

    const response = await postChat(app, {
      content: "Tinjau klausul PHK ini",
      forcedAgents: ["employment"],
    });
    const events = parseSseEvents(response.body as string);

    expect(mocks.createCompletion).toHaveBeenCalledTimes(6);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "agent_error",
        agent: "employment",
        message: expect.stringMatching(/batas permintaan/i),
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: "error" }),
    );
    expect(events.some((event) => event.type === "done")).toBe(false);
  });

  it("recovers when a streaming specialist succeeds after transient 429s", async () => {
    let specialistAttempts = 0;
    mocks.createCompletion.mockImplementation(async () => {
      specialistAttempts++;
      if (specialistAttempts < 3) {
        throw Object.assign(new Error("429 Too Many Requests"), {
          status: 429,
        });
      }
      return completionStream("Klausul perlu direvisi.");
    });

    const response = await postChat(app, {
      content: "Tinjau klausul PHK ini",
      forcedAgents: ["employment"],
    });
    const events = parseSseEvents(response.body as string);

    expect(specialistAttempts).toBe(3);
    expect(events).toContainEqual({
      type: "agent_chunk",
      agent: "employment",
      content: "Klausul perlu direvisi.",
    });
    expect(events).toContainEqual({
      type: "agent_done",
      agent: "employment",
    });
    expect(events).toContainEqual({ type: "done" });
    expect(events.some((event) => event.type === "error")).toBe(false);
  });

  it("keeps other specialists running when one specialist exhausts its retries", async () => {
    const rateLimitError = Object.assign(new Error("429 Too Many Requests"), {
      status: 429,
    });
    mocks.createCompletion.mockImplementation(
      async (params: { messages?: Array<{ content?: string }> }) => {
        const systemPrompt = params.messages?.[0]?.content ?? "";
        if (systemPrompt.includes("Corporate Lawyer AI")) {
          throw rateLimitError;
        }
        if (systemPrompt.includes("Tax Lawyer AI")) {
          return completionStream("Telaah ", "pajak selesai.");
        }
        throw new Error("Unexpected specialist");
      },
    );

    const response = await postChat(app, {
      content: "Tinjau transaksi perusahaan dan pajaknya",
      forcedAgents: ["corporate", "tax"],
    });
    const events = parseSseEvents(response.body as string);

    const taxStartIndex = events.findIndex(
      (event) => event.type === "agent_start" && event.agent === "tax",
    );
    const corporateErrorIndex = events.findIndex(
      (event) => event.type === "agent_error" && event.agent === "corporate",
    );

    expect(taxStartIndex).toBeGreaterThanOrEqual(0);
    expect(corporateErrorIndex).toBeGreaterThan(taxStartIndex);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "agent_chunk",
        agent: "tax",
        content: "Telaah ",
      }),
    );
    expect(events).toContainEqual({ type: "agent_done", agent: "tax" });
    expect(events).toContainEqual({ type: "done" });
    expect(events.some((event) => event.type === "error")).toBe(false);
  });

  it("persists non-empty partial output when a specialist stream is interrupted", async () => {
    mocks.createCompletion.mockResolvedValue(
      interruptedCompletionStream(
        "Analisis parsial yang sudah diterima.",
        Object.assign(new Error("429 while streaming"), { status: 429 }),
      ),
    );

    const response = await postChat(app, {
      content: "Tinjau klausul perusahaan ini",
      forcedAgents: ["corporate"],
    });
    const events = parseSseEvents(response.body as string);
    const savedAssistant = mocks.insertedValues.find(
      (value) => value.role === "assistant",
    );

    expect(events).toContainEqual({
      type: "agent_chunk",
      agent: "corporate",
      content: "Analisis parsial yang sudah diterima.",
    });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "agent_error",
        agent: "corporate",
      }),
    );
    expect(events).toContainEqual({ type: "done" });
    expect(savedAssistant?.content).toMatch(/respons parsial/i);
    expect(savedAssistant?.content).toContain(
      "Analisis parsial yang sudah diterima.",
    );
  });

  it("persists specialist fallbacks when synthesis exhausts its 429 retries", async () => {
    mocks.createCompletion.mockImplementation(
      async (params: { messages?: Array<{ content?: string }> }) => {
        const systemPrompt = params.messages?.[0]?.content ?? "";
        if (systemPrompt.includes("Synthesis Agent")) {
          throw Object.assign(new Error("429 Too Many Requests"), {
            status: 429,
          });
        }
        if (systemPrompt.includes("Corporate Lawyer AI")) {
          return completionStream("Telaah korporasi selesai.");
        }
        if (systemPrompt.includes("Tax Lawyer AI")) {
          return completionStream("Telaah pajak selesai.");
        }
        throw new Error("Unexpected completion request");
      },
    );

    const response = await postChat(app, {
      content: "Tinjau transaksi perusahaan dan pajaknya",
      forcedAgents: ["corporate", "tax"],
    });
    const events = parseSseEvents(response.body as string);
    const savedAssistant = mocks.insertedValues.find(
      (value) => value.role === "assistant",
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "synthesis_error",
        message: expect.stringMatching(/batas permintaan/i),
      }),
    );
    expect(events).toContainEqual({ type: "done" });
    expect(events.some((event) => event.type === "error")).toBe(false);
    expect(savedAssistant?.content).toContain("Telaah korporasi selesai.");
    expect(savedAssistant?.content).toContain("Telaah pajak selesai.");
    expect(savedAssistant?.content).toMatch(/sintesis akhir terkena batas/i);
  });
});