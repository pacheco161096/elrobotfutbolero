import { mentionsMatch } from "@/lib/engines/context";

type ImageHit = { image?: string; title?: string; url?: string; width?: number };

function rows(payload: unknown): ImageHit[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { results?: unknown }).results)) return [];
  return (payload as { results: ImageHit[] }).results;
}

export function pickWebImage(payload: unknown, teams: string[], avoid?: string | null): string | null {
  const usable = rows(payload).filter((item) => publicPhoto(item.image) && item.image !== avoid && (item.width == null || item.width >= 400));
  const named = usable.find((item) => mentionsMatch(`${item.title ?? ""} ${item.url ?? ""}`, teams));
  return (named ?? usable[0])?.image ?? null;
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
  input: { query: string; teams: string[]; avoid?: string | null },
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
  return pickWebImage(await images.json(), input.teams, input.avoid);
}
