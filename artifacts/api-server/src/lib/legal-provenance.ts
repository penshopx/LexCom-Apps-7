export const OFFICIAL_SOURCE_NAME = "Portal Peraturan.go.id";
export const OFFICIAL_SOURCE_ORIGIN = "https://peraturan.go.id";
export const OFFICIAL_CHECK_TIMEOUT_MS = 5000;
export const OFFICIAL_CHECK_CONCURRENCY = 5;
export const OFFICIAL_SUCCESS_CACHE_TTL_MS = 60 * 60 * 1000;
export const OFFICIAL_FAILURE_CACHE_TTL_MS = 5 * 60 * 1000;

export const REGULATION_STATUSES = [
  "active",
  "amended",
  "revoked",
  "unavailable",
] as const;

export type RegulationStatus = (typeof REGULATION_STATUSES)[number];

export interface RegulationReference {
  type: string;
  number: string;
  year?: string;
}

export interface RegulationProvenance extends RegulationReference {
  sourceName: string;
  sourceUrl: string;
  checkedAt: string | null;
  status: RegulationStatus;
}

const OFFICIAL_DOCUMENT_SLUG_TYPES: Record<string, string> = {
  UU: "uu",
  PP: "pp",
  PERPRES: "perpres",
};

const provenanceCache = new Map<
  string,
  { expiresAt: number; provenance: RegulationProvenance }
>();
const inFlightChecks = new Map<string, Promise<RegulationProvenance>>();
let activeOfficialChecks = 0;
let officialCheckWaiters: Array<() => void> = [];

function normalizeReference(reference: RegulationReference): RegulationReference {
  return {
    type: reference.type.trim().toUpperCase(),
    number: reference.number.trim(),
    ...(reference.year ? { year: reference.year.trim() } : {}),
  };
}

export function referenceKey(reference: RegulationReference): string {
  const normalized = normalizeReference(reference);
  return `${normalized.type}-${normalized.number}-${normalized.year ?? "unknown"}`;
}

export function formatReference(reference: RegulationReference): string {
  const normalized = normalizeReference(reference);
  return `${normalized.type} No. ${normalized.number}${normalized.year ? ` Tahun ${normalized.year}` : ""}`;
}

export function officialSourceUrl(reference: RegulationReference): string {
  const normalized = normalizeReference(reference);
  const slugType = OFFICIAL_DOCUMENT_SLUG_TYPES[normalized.type];

  if (slugType && normalized.year) {
    return `${OFFICIAL_SOURCE_ORIGIN}/id/${slugType}-no-${normalized.number}-tahun-${normalized.year}`;
  }

  return `${OFFICIAL_SOURCE_ORIGIN}/search?q=${encodeURIComponent(formatReference(normalized))}`;
}

function officialDocumentUrl(reference: RegulationReference): string | null {
  const normalized = normalizeReference(reference);
  const slugType = OFFICIAL_DOCUMENT_SLUG_TYPES[normalized.type];
  if (!slugType || !normalized.year) return null;
  return `${OFFICIAL_SOURCE_ORIGIN}/id/${slugType}-no-${normalized.number}-tahun-${normalized.year}`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x2F;|&#47;/gi, "/");
}

function textContent(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ).toLowerCase();
}

function extractStructuredStatus(html: string): string | null {
  const jsonStatus = html.match(
    /"(?:status_peraturan|statusPeraturan)"\s*:\s*"([^"]{1,120})"/i,
  )?.[1];
  if (jsonStatus) return textContent(jsonStatus);

  const labelValuePatterns = [
    /<(dt|th|div|span|p|label)\b[^>]*>\s*(?:status|status peraturan)\s*<\/\1>\s*<(dd|td|div|span|p|strong|b)\b[^>]*>([\s\S]{1,500}?)<\/\2>/i,
    /<(?:input|meta)\b[^>]*(?:name|property)=["'](?:status|status_peraturan|statusPeraturan)["'][^>]*(?:value|content)=["']([^"']{1,120})["'][^>]*>/i,
  ];

  for (const pattern of labelValuePatterns) {
    const match = html.match(pattern);
    const value = match?.[3] ?? match?.[1];
    if (value) return textContent(value);
  }

  return null;
}

/**
 * Only interprets labels found in the response body returned by the official
 * source. It deliberately does not accept a status from a model or caller.
 */
export function statusFromOfficialHtml(html: string): RegulationStatus {
  const statusText = extractStructuredStatus(html);
  if (!statusText) return "unavailable";

  if (
    /\b(dicabut|tidak berlaku|dinyatakan tidak berlaku)\b/.test(
      statusText,
    )
  ) {
    return "revoked";
  }
  if (
    /\b(diubah|perubahan|telah diubah|diubah dengan|diubah sebagian)\b/.test(
      statusText,
    )
  ) {
    return "amended";
  }
  if (/\b(berlaku|masih berlaku)\b/.test(statusText)) {
    return "active";
  }

  return "unavailable";
}

function normalizedPathname(url: URL): string {
  return url.pathname.replace(/\/+$/, "").toLowerCase();
}

function isExpectedOfficialDocumentUrl(
  responseUrl: string,
  expectedUrl: string,
): boolean {
  if (!responseUrl) return false;
  try {
    const url = new URL(responseUrl);
    const expected = new URL(expectedUrl);
    return (
      url.protocol === "https:" &&
      (url.hostname === "peraturan.go.id" ||
        url.hostname.endsWith(".peraturan.go.id")) &&
      normalizedPathname(url) === normalizedPathname(expected)
    );
  } catch {
    return false;
  }
}

function attributeFromTag(tag: string, attribute: string): string | null {
  return (
    tag.match(
      new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i"),
    )?.[1] ?? null
  );
}

function markupUrlMatchesExpected(html: string, expectedUrl: string): boolean {
  const urlTags = html.match(/<(?:link|meta)\b[^>]*>/gi) ?? [];
  return urlTags.some((tag) => {
    const rel = attributeFromTag(tag, "rel")?.toLowerCase();
    const property = attributeFromTag(tag, "property")?.toLowerCase();
    if (rel !== "canonical" && property !== "og:url") return false;
    const value =
      attributeFromTag(tag, "href") ?? attributeFromTag(tag, "content");
    return value ? isExpectedOfficialDocumentUrl(value, expectedUrl) : false;
  });
}

function identityPattern(reference: RegulationReference): RegExp | null {
  const normalized = normalizeReference(reference);
  if (!normalized.year) return null;
  const typePattern: Record<string, string> = {
    UU: "(?:undang-undang|uu)",
    PP: "(?:peraturan\\s+pemerintah|pp)",
    PERPRES: "(?:peraturan\\s+presiden|perpres)",
  };
  const type = typePattern[normalized.type];
  if (!type) return null;
  return new RegExp(
    `\\b${type}\\b(?:\\s+republik\\s+indonesia)?\\s+(?:nomor|no\\.?)\\s*${normalized.number}\\s+tahun\\s+${normalized.year}\\b`,
    "i",
  );
}

function markupIdentityMatches(
  html: string,
  reference: RegulationReference,
  expectedUrl: string,
): boolean {
  if (markupUrlMatchesExpected(html, expectedUrl)) return true;
  const pattern = identityPattern(reference);
  if (!pattern) return false;
  const identityMarkup = [...html.matchAll(/<(?:title|h1)\b[^>]*>([\s\S]{1,500}?)<\/(?:title|h1)>/gi)]
    .map((match) => textContent(match[1]))
    .join(" ");
  return pattern.test(identityMarkup);
}

async function withOfficialCheckSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (activeOfficialChecks >= OFFICIAL_CHECK_CONCURRENCY) {
    await new Promise<void>((resolve) => officialCheckWaiters.push(resolve));
  }
  activeOfficialChecks += 1;
  try {
    return await operation();
  } finally {
    activeOfficialChecks -= 1;
    officialCheckWaiters.shift()?.();
  }
}

export function resetLegalProvenanceCache(): void {
  provenanceCache.clear();
  inFlightChecks.clear();
  if (activeOfficialChecks === 0) officialCheckWaiters = [];
}

function unavailableProvenance(
  reference: RegulationReference,
  checkedAt: string,
): RegulationProvenance {
  return {
    ...normalizeReference(reference),
    sourceName: OFFICIAL_SOURCE_NAME,
    sourceUrl: officialSourceUrl(reference),
    checkedAt,
    status: "unavailable",
  };
}

export async function checkOfficialRegulation(
  reference: RegulationReference,
  fetchImpl: typeof fetch = fetch,
): Promise<RegulationProvenance> {
  const normalized = normalizeReference(reference);
  const key = referenceKey(normalized);
  const cached = provenanceCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.provenance;
  }

  const existingCheck = inFlightChecks.get(key);
  if (existingCheck) return existingCheck;

  const check = withOfficialCheckSlot(async () => {
    const checkedAt = new Date().toISOString();
    const sourceUrl = officialDocumentUrl(normalized);
    if (!sourceUrl) {
      const unavailable = unavailableProvenance(normalized, checkedAt);
      provenanceCache.set(key, {
        expiresAt: Date.now() + OFFICIAL_FAILURE_CACHE_TTL_MS,
        provenance: unavailable,
      });
      return unavailable;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      OFFICIAL_CHECK_TIMEOUT_MS,
    );

    try {
      const response = await fetchImpl(sourceUrl, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "LexCom-Official-Source-Checker/1.0",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      if (!response.ok || !isExpectedOfficialDocumentUrl(response.url, sourceUrl)) {
        const unavailable = unavailableProvenance(normalized, checkedAt);
        provenanceCache.set(key, {
          expiresAt: Date.now() + OFFICIAL_FAILURE_CACHE_TTL_MS,
          provenance: unavailable,
        });
        return unavailable;
      }

      const html = await response.text();
      const provenance: RegulationProvenance = {
        ...normalized,
        sourceName: OFFICIAL_SOURCE_NAME,
        sourceUrl,
        checkedAt,
        status: markupIdentityMatches(html, normalized, sourceUrl)
          ? statusFromOfficialHtml(html)
          : "unavailable",
      };
      provenanceCache.set(key, {
        expiresAt:
          Date.now() +
          (provenance.status === "unavailable"
            ? OFFICIAL_FAILURE_CACHE_TTL_MS
            : OFFICIAL_SUCCESS_CACHE_TTL_MS),
        provenance,
      });
      return provenance;
    } catch {
      const unavailable = unavailableProvenance(normalized, checkedAt);
      provenanceCache.set(key, {
        expiresAt: Date.now() + OFFICIAL_FAILURE_CACHE_TTL_MS,
        provenance: unavailable,
      });
      return unavailable;
    } finally {
      clearTimeout(timeoutId);
    }
  });
  inFlightChecks.set(key, check);
  try {
    return await check;
  } finally {
    if (inFlightChecks.get(key) === check) inFlightChecks.delete(key);
  }
}

export async function checkOfficialRegulations(
  references: RegulationReference[],
): Promise<RegulationProvenance[]> {
  const results = new Array<RegulationProvenance>(references.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(OFFICIAL_CHECK_CONCURRENCY, references.length) },
    async () => {
      while (nextIndex < references.length) {
        const index = nextIndex++;
        results[index] = await checkOfficialRegulation(references[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}