import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

vi.mock("./routes", () => {
  const { Router } = require("express");
  const router = Router();
  return { default: router };
});

vi.mock("./middlewares/authMiddleware", () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("./lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

vi.mock("pino-http", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockQuery = vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] });

vi.mock("@workspace/db", () => ({
  pool: { query: mockQuery },
  db: {},
}));

const { default: app, setReady, resetDbPingCache } = await import("./app");

describe("readiness gate", () => {
  beforeEach(() => {
    setReady(false);
    resetDbPingCache();
    mockQuery.mockResolvedValue({ rows: [{ "?column?": 1 }] });
  });

  it("returns 503 on /health when not ready", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "not ready" });
  });

  it("returns 200 on /health when ready", async () => {
    setReady(true);
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });

  it("returns 503 on /health when ready but db is unreachable", async () => {
    setReady(true);
    mockQuery.mockRejectedValue(new Error("connection refused"));
    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "db unreachable" });
  });

  it("returns 503 on a non-/health route when not ready", async () => {
    const res = await request(app).get("/api/some-route");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "not ready" });
  });
});

describe("db ping cache", () => {
  beforeEach(() => {
    setReady(true);
    resetDbPingCache();
    mockQuery.mockClear();
    mockQuery.mockResolvedValue({ rows: [{ "?column?": 1 }] });
  });

  it("only pings the database once within the TTL", async () => {
    await request(app).get("/health");
    await request(app).get("/health");
    await request(app).get("/health");
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("returns the cached ok result on subsequent calls within TTL", async () => {
    await request(app).get("/health");
    mockQuery.mockRejectedValue(new Error("should not be called"));
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });

  it("re-pings the database after the cache expires", async () => {
    vi.useFakeTimers();
    resetDbPingCache();

    await request(app).get("/health");
    expect(mockQuery).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3000);

    await request(app).get("/health");
    expect(mockQuery).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
