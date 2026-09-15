import { useQuery } from "@tanstack/react-query";
import {
  checkRegulationStatuses,
  type RegulationProvenance,
  type RegulationReference,
} from "@workspace/api-client-react";

export const PROVENANCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const PROVENANCE_REQUEST_MAX_REFERENCES = 50;

export function regulationReferenceKey(
  reference: RegulationReference,
): string {
  return `${reference.type.trim().toUpperCase()}-${reference.number.trim()}-${
    reference.year?.trim() ?? "unknown"
  }`;
}

export function isFreshProvenance(
  provenance: RegulationProvenance | undefined,
  now = Date.now(),
): provenance is RegulationProvenance {
  if (!provenance?.checkedAt || provenance.status === "unavailable") {
    return false;
  }
  const checkedAt = Date.parse(provenance.checkedAt);
  return Number.isFinite(checkedAt) && now - checkedAt <= PROVENANCE_MAX_AGE_MS;
}

export function provenanceStatusLabel(
  provenance: RegulationProvenance | undefined,
): string {
  if (!isFreshProvenance(provenance)) return "Perlu verifikasi";
  if (provenance.status === "active") return "Berlaku";
  if (provenance.status === "amended") return "Diubah";
  return "Dicabut";
}

export function provenanceStatusClass(
  provenance: RegulationProvenance | undefined,
): string {
  if (!isFreshProvenance(provenance)) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  if (provenance.status === "active") {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }
  if (provenance.status === "amended") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }
  return "border-red-500/30 bg-red-500/10 text-red-300";
}

export function formatCheckedAt(checkedAt: string | null | undefined): string {
  if (!checkedAt) return "Belum diperiksa";
  const date = new Date(checkedAt);
  if (Number.isNaN(date.getTime())) return "Waktu pemeriksaan tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function useRegulationProvenance(
  references: RegulationReference[],
) {
  const uniqueReferences = [
    ...new Map(
      references.map((reference) => [
        regulationReferenceKey(reference),
        reference,
      ]),
    ).values(),
  ];
  const keys = uniqueReferences.map(regulationReferenceKey);

  return useQuery({
    queryKey: ["official-regulation-provenance", keys],
    queryFn: async ({ signal }) => {
      const batches: RegulationReference[][] = [];
      for (
        let index = 0;
        index < uniqueReferences.length;
        index += PROVENANCE_REQUEST_MAX_REFERENCES
      ) {
        batches.push(
          uniqueReferences.slice(
            index,
            index + PROVENANCE_REQUEST_MAX_REFERENCES,
          ),
        );
      }
      const responses = await Promise.all(
        batches.map((references) =>
          checkRegulationStatuses(
            { references },
            { signal, credentials: "include" },
          ),
        ),
      );
      return { sources: responses.flatMap((response) => response.sources) };
    },
    enabled: uniqueReferences.length > 0,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}

export function provenanceMap(
  sources: RegulationProvenance[] | undefined,
): Map<string, RegulationProvenance> {
  return new Map(
    (sources ?? []).map((source) => [
      regulationReferenceKey(source),
      source,
    ]),
  );
}