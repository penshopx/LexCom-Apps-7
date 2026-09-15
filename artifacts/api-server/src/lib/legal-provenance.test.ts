import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkOfficialRegulation,
  officialSourceUrl,
  resetLegalProvenanceCache,
  statusFromOfficialHtml,
} from "./legal-provenance";

function officialResponse(url: string, html: string) {
  return {
    ok: true,
    url,
    text: async () => html,
  } as Response;
}

describe("official regulation provenance", () => {
  beforeEach(() => {
    resetLegalProvenanceCache();
  });

  it.each([
    ["<div>Status</div><strong>Berlaku</strong>", "active"],
    ["<dt>Status</dt><dd>Telah diubah dengan peraturan baru</dd>", "amended"],
    ["<span>Status</span><span>Dicabut</span>", "revoked"],
    ["<p>Peraturan ini berlaku nasional tanpa label metadata.</p>", "unavailable"],
    [
      "<div>Status layanan</div><p>Peraturan ini berlaku secara nasional.</p>",
      "unavailable",
    ],
  ])("reads only an official status label from HTML", (html, expected) => {
    expect(statusFromOfficialHtml(html)).toBe(expected);
  });

  it("returns official source URL, checked time, and parsed status", async () => {
    const fetchImpl = vi.fn(async () =>
      officialResponse(
        "https://peraturan.go.id/id/uu-no-13-tahun-2003",
        '<link rel="canonical" href="https://peraturan.go.id/id/uu-no-13-tahun-2003"><div>Status</div><div>Berlaku</div>',
      ),
    ) as unknown as typeof fetch;

    const result = await checkOfficialRegulation(
      { type: "UU", number: "13", year: "2003" },
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://peraturan.go.id/id/uu-no-13-tahun-2003",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result).toMatchObject({
      sourceName: "Portal Peraturan.go.id",
      sourceUrl: "https://peraturan.go.id/id/uu-no-13-tahun-2003",
      status: "active",
    });
    expect(Number.isNaN(Date.parse(result.checkedAt ?? ""))).toBe(false);
  });

  it("keeps network failures unavailable instead of guessing a status", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network unavailable");
    }) as unknown as typeof fetch;

    const result = await checkOfficialRegulation(
      { type: "PERMENAKER", number: "18", year: "2022" },
      fetchImpl,
    );

    expect(result.status).toBe("unavailable");
    expect(result.checkedAt).not.toBeNull();
    expect(result.sourceUrl).toBe(
      officialSourceUrl({
        type: "PERMENAKER",
        number: "18",
        year: "2022",
      }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects status content after a redirect leaves the official domain", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      url: "https://example.invalid/copied-page",
      text: async () => "<div>Status</div><div>Berlaku</div>",
    })) as unknown as typeof fetch;

    const result = await checkOfficialRegulation(
      { type: "UU", number: "1", year: "2023" },
      fetchImpl,
    );

    expect(result.status).toBe("unavailable");
  });

  it("rejects a different regulation returned from the official host", async () => {
    const fetchImpl = vi.fn(async () =>
      officialResponse(
        "https://peraturan.go.id/id/uu-no-1-tahun-2023",
        "<h1>Undang-Undang Nomor 2 Tahun 2023</h1><div>Status</div><div>Berlaku</div>",
      ),
    ) as unknown as typeof fetch;

    const result = await checkOfficialRegulation(
      { type: "UU", number: "1", year: "2023" },
      fetchImpl,
    );

    expect(result.status).toBe("unavailable");
  });

  it("does not treat a generic JSON status as document status", async () => {
    const fetchImpl = vi.fn(async () =>
      officialResponse(
        "https://peraturan.go.id/id/pp-no-1-tahun-2024",
        '<h1>Peraturan Pemerintah Nomor 1 Tahun 2024</h1><script>{"status":"berlaku"}</script>',
      ),
    ) as unknown as typeof fetch;

    const result = await checkOfficialRegulation(
      { type: "PP", number: "1", year: "2024" },
      fetchImpl,
    );

    expect(result.status).toBe("unavailable");
  });

  it("coalesces simultaneous checks for the same regulation", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return officialResponse(
        String(url),
        `<h1>Undang-Undang Nomor 1 Tahun 2024</h1><div>Status</div><div>Berlaku</div>`,
      );
    }) as unknown as typeof fetch;

    const reference = { type: "UU", number: "1", year: "2024" };
    const [first, second] = await Promise.all([
      checkOfficialRegulation(reference, fetchImpl),
      checkOfficialRegulation(reference, fetchImpl),
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it("limits outbound checks globally across simultaneous callers", async () => {
    let active = 0;
    let maximumActive = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      const match = String(url).match(/uu-no-(\d+)-tahun-2024/);
      const number = match?.[1] ?? "0";
      return officialResponse(
        String(url),
        `<h1>Undang-Undang Nomor ${number} Tahun 2024</h1><div>Status</div><div>Berlaku</div>`,
      );
    }) as unknown as typeof fetch;

    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        checkOfficialRegulation(
          { type: "UU", number: String(index + 1), year: "2024" },
          fetchImpl,
        ),
      ),
    );

    expect(maximumActive).toBeLessThanOrEqual(5);
  });
});