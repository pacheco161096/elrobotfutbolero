export type SocialHit = {
  text: string;
  url: string | null;
  author: string | null;
  imageUrl?: string | null;
};

const TEAM_SKIP = new Set(["club", "atletico", "athletic"]);

export function mentionsMatch(text: string, teams: string[]): boolean {
  const haystack = normalize(text);
  return teams.some((team) =>
    normalize(team)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4 && !TEAM_SKIP.has(token))
      .some((token) => haystack.includes(token)),
  );
}

export function reviewSocialHits(input: { known: string[]; hits: SocialHit[] }): {
  decision: "DISCARD" | "MONITOR";
  reason: string;
  claims: Array<{ text: string; url: string | null; author: string; imageUrl: string | null }>;
} {
  const hits = input.hits.filter((hit) => hit.text.trim());
  if (hits.length === 0) {
    return { decision: "DISCARD", reason: "Las páginas no trajeron contexto del partido. No se fuerza un segundo post.", claims: [] };
  }
  const review = secondContextPost({ known: input.known, incoming: hits.map((hit) => hit.text) });
  if (review.decision === "DISCARD") {
    return { decision: "DISCARD", reason: review.reason, claims: [] };
  }
  const known = new Set(input.known.map(normalize));
  const claims = hits
    .filter((hit) => !known.has(normalize(hit.text)))
    .map((hit) => ({
      text: hit.text.trim(),
      url: hit.url,
      author: hit.author?.trim() || "publicación pública",
      imageUrl: hit.imageUrl ?? null,
    }));
  return {
    decision: "MONITOR",
    reason: "Las páginas trajeron contexto del partido. Sigue sin confirmar: no se presenta como dato del marcador.",
    claims,
  };
}

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
    return { decision: "DISCARD", reason: "Ese texto ya estaba. No se repite el segundo post." };
  }
  return {
    decision: "UPDATE_EXISTING_STORY",
    reason: "Las páginas trajeron contexto del partido. Puede salir el segundo post.",
  };
}
