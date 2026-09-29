import { mentionsMatch } from "@/lib/engines/context";
import { contradictsScore } from "@/lib/engines/match-pulse";

type ImageHit = { image?: string; title?: string; url?: string; width?: number };

const BRANDED = /tudn|getty|shutterstock|alamy|dreamstime|istock|depositphotos|watermark|espn|fox\s?sports|sky\s?sports|mediotiempo|televisa|tv\s?azteca|marca\.com|\bas\.com|record\.mx|amistoso|friendly|broadcast|grafico|gráfico/;

function rows(payload: unknown): ImageHit[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { results?: unknown }).results)) return [];
  return (payload as { results: ImageHit[] }).results;
}

function branded(item: ImageHit): boolean {
  const text = `${item.title ?? ""} ${item.url ?? ""} ${item.image ?? ""}`.toLowerCase();
  return BRANDED.test(text);
}

export function pickWebImage(
  payload: unknown,
  teams: string[],
  avoid?: string | null,
  score?: { home: number; away: number } | null,
): string | null {
  const usable = rows(payload).filter((item) => {
    if (!publicPhoto(item.image) || item.image === avoid || branded(item)) return false;
    if (item.width != null && item.width < 400) return false;
    const caption = `${item.title ?? ""} ${item.url ?? ""}`;
    if (score && contradictsScore(caption, score.home, score.away)) return false;
    return mentionsMatch(caption, teams);
  });
  return usable[0]?.image ?? null;
}

function publicPhoto(url: string | undefined): url is string {
  if (!url?.startsWith("https://")) return false;
  try {
    const host = new URL(url).hostname;
    return !/(^|\.)facebook\.com$|(^|\.)fbcdn\.net$|(^|\.)instagram\.com$|(^|\.)duckduckgo\.com$/.test(host);
  } catch {
    return false;
  }
}

export async function searchMatchImage(
  input: { query: string; teams: string[]; avoid?: string | null; homeScore?: number | null; awayScore?: number | null },
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const query = input.query.trim();
  if (!query) return null;
  const home = await fetchImpl(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!home.ok) return null;
  const token = ((await home.text()).match(/vqd="([^"]+)"/) ?? [])[1];
  if (!token) return null;
  const images = await fetchImpl(
    `https://duckduckgo.com/i.js?l=mx-es&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(token)}&f=,,,,,&p=1`,
    { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://duckduckgo.com/" } },
  );
  if (!images.ok) return null;
  const score = input.homeScore == null || input.awayScore == null ? null : { home: input.homeScore, away: input.awayScore };
  return pickWebImage(await images.json(), input.teams, input.avoid, score);
}
