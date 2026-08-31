import { AlertTriangle, BookOpenCheck, ExternalLink } from "lucide-react";
import { dataPeraturan } from "@/data/peraturan";

type LegalReference = {
  label: string;
  number: string;
  year?: string;
  article?: string;
  inCatalog: boolean;
  sourceName: string;
  sourceUrl: string;
};

const REFERENCE_PATTERN = /\b(UUD|UU|PP|PERPRES|PERMA|SEMA|PERMEN[A-Z]*)\s*(?:RI\s*)?(?:(?:NO(?:MOR)?\.?)\s*)?(\d+)(?:\s*(?:\/|TAHUN)\s*(\d{4}))?/gi;

function extractReferences(content: string): LegalReference[] {
  const unique = new Map<string, LegalReference>();

  for (const match of content.matchAll(REFERENCE_PATTERN)) {
    const type = match[1].toUpperCase();
    const number = match[2];
    const year = match[3];
    const afterReference = content.slice(
      (match.index ?? 0) + match[0].length,
      (match.index ?? 0) + match[0].length + 100
    );
    const article = afterReference.match(/\bPasal\s+\d+[A-Za-z]?(?:\s+ayat\s+\(\d+\))?/i)?.[0];
    const key = `${type}-${number}-${year ?? "unknown"}`;
    if (unique.has(key)) continue;

    const catalogItem = dataPeraturan.find((item) => {
      const catalogNumbers = item.nomor.match(/\d+/g) ?? [];
      const sameNumber = catalogNumbers[0] === number;
      const sameYear = !year || catalogNumbers.includes(year);
      const sameType = type === "PERMEN"
        ? item.jenis === "Permen"
        : item.jenis.toUpperCase() === type;
      return sameNumber && sameYear && sameType;
    });

    unique.set(key, {
      label: match[0].replace(/\s+/g, " ").trim(),
      number,
      year,
      article,
      inCatalog: Boolean(catalogItem),
      sourceName: "Peraturan.go.id",
      sourceUrl: `https://peraturan.go.id/search?q=${encodeURIComponent(match[0].replace(/\s+/g, " ").trim())}`,
    });
  }

  return [...unique.values()].slice(0, 6);
}

export function LegalAnswerTrust({
  content,
  compact = false,
}: {
  content: string;
  compact?: boolean;
}) {
  const references = extractReferences(content);
  const catalogCount = references.filter((reference) => reference.inCatalog).length;
  const requiredSections = [
    "Kesimpulan",
    "Dasar Hukum",
    "Analisis",
    "Asumsi dan Batasan",
    "Tingkat Keyakinan",
    "Langkah Berikutnya",
  ];
  const structured = requiredSections.every((section) =>
    new RegExp(`#{1,4}\\s*${section}`, "i").test(content)
  );

  const status = catalogCount > 0
    ? {
        icon: BookOpenCheck,
        title: `${catalogCount} rujukan ditemukan di katalog LexCom`,
        detail: "Kecocokan katalog membantu penelusuran, tetapi status dan isi tetap perlu diperiksa pada sumber resmi.",
        color: "border-blue-500/25 bg-blue-500/8 text-blue-300",
      }
    : references.length > 0
      ? {
          icon: AlertTriangle,
          title: "Sitasi disebut AI, status perlu diperiksa",
          detail: "Buka sumber resmi sebelum menjadikannya dasar keputusan.",
          color: "border-amber-500/25 bg-amber-500/8 text-amber-300",
        }
      : {
          icon: AlertTriangle,
          title: "Belum ada sitasi eksplisit",
          detail: "Minta AI menyebutkan nomor, tahun, dan pasal, lalu periksa sumber resminya.",
          color: "border-red-500/25 bg-red-500/8 text-red-300",
        };

  const StatusIcon = status.icon;

  return (
    <aside className={`not-prose rounded-xl border ${status.color} ${compact ? "p-2.5" : "p-3"}`}>
      <div className="flex items-start gap-2">
        <StatusIcon className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold">{status.title}</p>
            <span className="rounded-full border border-white/10 bg-black/10 px-2 py-0.5 text-[9px] font-medium text-foreground/70">
              {structured ? "Format bukti lengkap" : "Format bebas"}
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{status.detail}</p>

          {references.length > 0 && (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {references.map((reference) => (
                <a
                  key={`${reference.label}-${reference.year ?? ""}`}
                  href={reference.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-white/10 bg-background/40 px-2.5 py-2 text-[10px] text-foreground/80 transition-colors hover:border-primary/40"
                  title="Buka pencarian pada portal resmi untuk memeriksa sumber"
                >
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <BookOpenCheck className="w-3 h-3" />
                    {reference.label}
                    <ExternalLink className="ml-auto w-2.5 h-2.5" />
                  </span>
                  {reference.article && (
                    <span className="mt-0.5 block text-foreground/70">{reference.article}</span>
                  )}
                  <span className="mt-1 block text-muted-foreground">Sumber: {reference.sourceName}</span>
                  <span className={reference.inCatalog ? "text-blue-300" : "text-amber-300"}>
                    {reference.inCatalog
                      ? "Ditemukan di katalog · verifikasi status resmi"
                      : "Belum dikenali katalog · perlu verifikasi"}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}