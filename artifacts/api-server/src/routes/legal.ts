import { Router, type IRouter } from "express";
import {
  checkOfficialRegulations,
  type RegulationReference,
} from "../lib/legal-provenance";

const router: IRouter = Router();
const MAX_REFERENCES = 50;
const REFERENCE_TYPE_PATTERN = /^[A-Z][A-Z0-9/ -]{0,23}$/i;
const REFERENCE_NUMBER_PATTERN = /^\d{1,12}$/;
const REFERENCE_YEAR_PATTERN = /^\d{4}$/;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export function resetLegalSourceRateLimit(): void {
  rateLimitBuckets.clear();
}

function isRateLimited(clientId: string, now = Date.now()): boolean {
  const bucket = rateLimitBuckets.get(clientId);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(clientId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

function isRegulationReference(value: unknown): value is RegulationReference {
  if (!value || typeof value !== "object") return false;
  const reference = value as Record<string, unknown>;
  return (
    typeof reference.type === "string" &&
    REFERENCE_TYPE_PATTERN.test(reference.type.trim()) &&
    typeof reference.number === "string" &&
    REFERENCE_NUMBER_PATTERN.test(reference.number.trim()) &&
    (reference.year === undefined ||
      (typeof reference.year === "string" &&
        REFERENCE_YEAR_PATTERN.test(reference.year.trim())))
  );
}

router.post("/legal/regulations/status", async (req, res) => {
  if (isRateLimited(req.ip ?? req.socket.remoteAddress ?? "unknown")) {
    res.status(429).json({
      error: "Terlalu banyak pemeriksaan sumber resmi. Coba lagi sebentar.",
    });
    return;
  }

  const references = req.body?.references;

  if (
    !Array.isArray(references) ||
    references.length < 1 ||
    references.length > MAX_REFERENCES ||
    references.some((reference) => !isRegulationReference(reference))
  ) {
    res.status(400).json({
      error: `references harus berisi 1-${MAX_REFERENCES} rujukan peraturan yang valid`,
    });
    return;
  }

  const uniqueReferences = [
    ...new Map(
      references.map((reference) => {
        const normalized: RegulationReference = {
          type: reference.type.trim().toUpperCase(),
          number: reference.number.trim(),
          ...(reference.year ? { year: reference.year.trim() } : {}),
        };
        return [
          `${normalized.type}-${normalized.number}-${normalized.year ?? "unknown"}`,
          normalized,
        ];
      }),
    ).values(),
  ];

  const sources = await checkOfficialRegulations(uniqueReferences);
  res.json({ sources });
});

export default router;