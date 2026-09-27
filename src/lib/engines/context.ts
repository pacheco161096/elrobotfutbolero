function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function secondContextPost(input: { known: string[]; incoming: string[] }): {
  decision: "DISCARD" | "UPDATE_EXISTING_STORY";
  reason: string;
} {
  const known = new Set(input.known.map(normalize).filter(Boolean));
  const fresh = input.incoming.map(normalize).filter((item) => item && !known.has(item));
  if (fresh.length === 0) {
    return { decision: "DISCARD", reason: "No hay contexto nuevo. No se fuerza un segundo post." };
  }
  return {
    decision: "UPDATE_EXISTING_STORY",
    reason: "Hay información nueva. Se actualiza la historia antes de evaluar otro post.",
  };
}
