/**
 * Deployment smoke test
 *
 * This test intentionally runs outside the unit-test suite. It exercises the
 * public routing layer by making a real HTTP request to a deployed API.
 *
 * Run with:
 *   SMOKE_BASE_URL=https://example.replit.app pnpm --filter @workspace/api-server run test:smoke
 */
import { describe, expect, it } from "vitest";

const REQUEST_TIMEOUT_MS = 10_000;

function getSmokeBaseUrl(): string {
  const value = process.env["SMOKE_BASE_URL"]?.trim();
  if (!value) {
    throw new Error(
      "SMOKE_BASE_URL is required. Set it to the public deployment URL before running the smoke test.",
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`SMOKE_BASE_URL must be a valid URL; received "${value}".`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `SMOKE_BASE_URL must use http or https; received "${url.protocol}".`,
    );
  }

  return value.replace(/\/+$/, "");
}

describe("smoke: deployed GET /api/healthz", () => {
  it("is reachable through the public deployment and reports healthy", async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${getSmokeBaseUrl()}/api/healthz`, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(responseText);
    } catch {
      throw new Error(
        `Expected JSON from /api/healthz, received ${response.status}: ${responseText.slice(0, 200)}`,
      );
    }

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});