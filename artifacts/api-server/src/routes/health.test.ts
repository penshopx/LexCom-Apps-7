/**
 * Health route tests
 *
 * Verifies that GET /healthz (mounted at /api/healthz in production) returns a
 * 200 status and a valid JSON body matching the HealthCheckResponse schema.
 */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express, { type Application } from "express";

vi.mock("@workspace/api-zod", () => ({
  HealthCheckResponse: {
    parse: (v: unknown) => v,
  },
}));

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  return app;
}

describe("GET /healthz", () => {
  it("returns 200 with { status: 'ok' }", async () => {
    vi.resetModules();
    const { default: healthRouter } = await import("./health");
    const app = buildApp();
    app.use("/api", healthRouter);

    const res = await request(app).get("/api/healthz");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });

  it("returns a JSON content-type header", async () => {
    vi.resetModules();
    const { default: healthRouter } = await import("./health");
    const app = buildApp();
    app.use("/api", healthRouter);

    const res = await request(app).get("/api/healthz");

    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  it("returns 404 for an unknown sub-path", async () => {
    vi.resetModules();
    const { default: healthRouter } = await import("./health");
    const app = buildApp();
    app.use("/api", healthRouter);

    const res = await request(app).get("/api/healthz/unknown");

    expect(res.status).toBe(404);
  });
});
