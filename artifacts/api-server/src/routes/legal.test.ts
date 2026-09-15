import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Application } from "express";
import request from "supertest";
import legalRouter, { resetLegalSourceRateLimit } from "./legal";
import { resetLegalProvenanceCache } from "../lib/legal-provenance";

function officialResponse(url: string, html: string) {
  return {
    ok: true,
    url,
    text: async () => html,
  } as Response;
}

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use(legalRouter);
  return app;
}

describe("regulation status route", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    resetLegalSourceRateLimit();
    resetLegalProvenanceCache();
  });

  it("rejects malformed references without contacting the official source", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(buildApp())
      .post("/legal/regulations/status")
      .send({ references: [{ type: "UU", number: "not-a-number" }] });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deduplicates references and returns official provenance", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      officialResponse(
        String(url),
        '<h1>Undang-Undang Nomor 11 Tahun 2020</h1><div>Status</div><div>Dicabut</div>',
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const reference = { type: "uu", number: "11", year: "2020" };
    const response = await request(buildApp())
      .post("/legal/regulations/status")
      .send({ references: [reference, reference] });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.body.sources).toEqual([
      expect.objectContaining({
        type: "UU",
        number: "11",
        year: "2020",
        sourceUrl: "https://peraturan.go.id/id/uu-no-11-tahun-2020",
        status: "revoked",
      }),
    ]);
    expect(response.body.sources[0].checkedAt).toEqual(expect.any(String));
  });

  it("returns unavailable when the official source cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const response = await request(buildApp())
      .post("/legal/regulations/status")
      .send({ references: [{ type: "PP", number: "35", year: "2021" }] });

    expect(response.status).toBe(200);
    expect(response.body.sources[0]).toEqual(
      expect.objectContaining({
        status: "unavailable",
        sourceName: "Portal Peraturan.go.id",
      }),
    );
  });
});