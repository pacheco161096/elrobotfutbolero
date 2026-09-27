import type { ClaimStatus, SourceKind, SourceRef, TruthStatus } from "@/lib/domain/types";

const RANK: Record<SourceKind, number> = {
  oficial: 7,
  api: 6,
  periodista: 5,
  medio: 4,
  local: 3,
  fanpage: 2,
  usuario: 1,
};

export function classifyTruth(input: {
  origin: "api_event" | "claim";
  sources: SourceRef[];
}): TruthStatus {
  if (input.origin === "api_event") {
    const disagrees = input.sources.some((source) => source.stance === "contradice");
    return disagrees ? "CONTRADICCION" : "DATO_CONFIRMADO";
  }

  const support = input.sources.filter((source) => source.stance === "apoya");
  const against = input.sources.filter((source) => source.stance === "contradice");
  if (support.length > 0 && against.length > 0) return "CONTRADICCION";
  if (support.length === 0) return "INFORMACION_NO_CONFIRMADA";

  const best = Math.max(...support.map((source) => RANK[source.kind]));
  if (best >= RANK.api) return "DATO_CONFIRMADO";
  if (support.length >= 2 && best >= RANK.medio) return "DATO_CONFIRMADO";
  if (best >= RANK.medio) return "DATO_PROBABLE";
  return "AFIRMACION_DE_UNA_FUENTE";
}

export function claimStatusFromTruth(truth: TruthStatus, sourceCount: number): ClaimStatus {
  if (truth === "CONTRADICCION") return "CONTRADICTED";
  if (truth === "DATO_CONFIRMADO") return "CONFIRMED";
  if (truth === "DATO_PROBABLE") return "SUPPORTED";
  if (truth === "INFORMACION_NO_CONFIRMADA" || sourceCount === 0) return "UNKNOWN";
  return "UNCONFIRMED";
}
