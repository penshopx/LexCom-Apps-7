import { AlertTriangle, BookOpenCheck, ExternalLink, ShieldCheck } from "lucide-react";
import { dataPeraturan } from "@/data/peraturan";

type LegalReference = {
  label: string;
  number: string;
  year?: string;
  inCatalog: boolean;
};

const REFERENCE_PATTERN = /\b(UUD|UU|PP|PERPRES|PERMA|SEMA|PERMEN[A-Z]*)\s*(?:RI\s*)?(?:(?:NO(?:MOR)?\.?)\s*)?(\d+)(?:\s*(?:\/|TAHUN)\s*(\d{4}))?/gi;

function extractReferences(content: string): LegalReference[] {
  const unique = new Map<string, LegalReference>();

  for (const match of content.matchAll(REFERENCE_PATTERN)) {
    const type = match[1].toUpperCase();
    const number = match[2];
    const year = match[3];
    const key = `${type}-${number}-${year ?? "unknown"}`;
    if (unique.has(key)) continue;

    const inCatalog = dataPeraturan.some((item) => {
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
      inCatalog,
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
  const structured = /#{1,4}\s*(Kesimpulan|Dasar Hukum|Asumsi dan Batasan|Langkah Berikutnya)/i.test(content);

  const status = catalogCount > 0
    ? {
        icon: ShieldCheck,
        title: `${catalogCount} rujukan dikenali katalog LexCom`,
        detail: "Kecocokan katalog bukan bukti bahwa status regulasi masih berlaku.",
        color: "border-emerald-500/25 bg-emerald-500/8 text-emerald-300",
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
            <div className="mt-2 flex flex-wrap gap-1.5">
              {references.map((reference) => (
                <a
                  key={`${reference.label}-${reference.year ?? ""}`}
                  href={`https://peraturan.go.id/search?q=${encodeURIComponent(reference.label)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-background/40 px-2 py-1 text-[10px] text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
                  title={reference.inCatalog ? "Dikenali dalam katalog LexCom; cek status pada sumber resmi" : "Cari pada portal resmi"}
                >
                  <BookOpenCheck className="w-3 h-3" />
                  <span>{reference.label}</span>
                  <span className={reference.inCatalog ? "text-emerald-400" : "text-amber-400"}>
                    {reference.inCatalog ? "Katalog" : "Cek"}
                  </span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}