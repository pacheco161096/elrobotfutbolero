import type { SocialHit } from "@/lib/engines/context";

const BRIGHT_DATA_ORIGIN = "https://api.brightdata.com";
const PAGE_LIMIT = 20;
const TEXT_FIELDS = ["post_text", "text", "content", "description", "caption", "title"] as const;
const AUTHOR_FIELDS = ["user_name", "author", "page_name", "username"] as const;
const IMAGE_FIELDS = ["post_image", "image", "thumbnail_url"] as const;
const URL_FIELDS = ["url", "post_url", "link"] as const;

function imageFrom(record: Record<string, unknown>): string | null {
  for (const key of IMAGE_FIELDS) {
    const value = record[key];
    if (typeof value !== "string" || !value.startsWith("https://")) continue;
    try {
      const host = new URL(value).hostname;
      if (host === "facebook.com" || host === "www.facebook.com") continue;
      return value;
    } catch {
      continue;
    }
  }
  return null;
}

export function facebookPageUrls(raw: string | undefined): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const part of (raw ?? "").split(/[\s,]+/)) {
    let parsed: URL;
    try {
      parsed = new URL(part);
    } catch {
      continue;
    }
    if (parsed.protocol !== "https:") continue;
    if (parsed.hostname !== "www.facebook.com" && parsed.hostname !== "facebook.com") continue;
    const path = parsed.pathname.replace(/\/$/, "");
    const profileId = path === "/profile.php" ? parsed.searchParams.get("id") : null;
    const href = profileId && /^\d+$/.test(profileId)
      ? `https://www.facebook.com/profile.php?id=${profileId}`
      : `https://www.facebook.com${path}`;
    if (href === "https://www.facebook.com" || seen.has(href)) continue;
    seen.add(href);
    urls.push(href);
    if (urls.length >= PAGE_LIMIT) break;
  }
  return urls;
}

export function brightDataMissing(env: Record<string, string | undefined>): string[] {
  const missing = [
    ["BRIGHT_DATA_API_KEY", env.BRIGHT_DATA_API_KEY],
    ["BRIGHT_DATA_DATASET_ID", env.BRIGHT_DATA_DATASET_ID],
  ]
    .filter((pair): pair is [string, string | undefined] => !pair[1])
    .map(([name]) => name);
  if (!facebookPageUrls(env.BRIGHT_DATA_PAGE_URLS).length) missing.push("BRIGHT_DATA_PAGE_URLS");
  return missing;
}

export function readSocialHits(payload: unknown): SocialHit[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : [];
  const hits: SocialHit[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (typeof record.error === "string") continue;
    const text = TEXT_FIELDS.map((key) => record[key]).find((value) => typeof value === "string" && value.trim().length >= 12);
    if (typeof text !== "string") continue;
    const author = AUTHOR_FIELDS.map((key) => record[key]).find((value) => typeof value === "string" && value.trim());
    const url = URL_FIELDS.map((key) => record[key]).find((value) => typeof value === "string" && value.startsWith("http"));
    hits.push({
      text: text.trim().slice(0, 500),
      url: typeof url === "string" ? url : null,
      author: typeof author === "string" ? author.trim().slice(0, 120) : null,
      imageUrl: imageFrom(record),
    });
    if (hits.length >= 8) break;
  }
  return hits;
}

async function brightFetch(
  path: string,
  env: Record<string, string | undefined>,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetchImpl(new URL(path, BRIGHT_DATA_ORIGIN), {
    ...init,
    headers: {
      Authorization: `Bearer ${env.BRIGHT_DATA_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

export async function triggerSocialSearch(
  urls: string[],
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch = fetch,
  postsPerPage = 3,
): Promise<{ status: "pending_credentials"; missing: string[] } | { status: "triggered"; snapshotId: string } | { status: "error"; message: string }> {
  const missing = brightDataMissing(env);
  if (missing.length) return { status: "pending_credentials", missing };
  const pages = facebookPageUrls(urls.join(","));
  if (!pages.length) return { status: "error", message: "No hay fanpages de Facebook para consultar." };
  const datasetId = encodeURIComponent(env.BRIGHT_DATA_DATASET_ID as string);
  const result = await brightFetch(`/datasets/v3/trigger?dataset_id=${datasetId}&format=json`, env, {
    method: "POST",
    body: JSON.stringify(pages.map((url) => ({ url, num_of_posts: postsPerPage }))),
  }, fetchImpl);
  const snapshotId = result.body && typeof result.body === "object" ? (result.body as { snapshot_id?: unknown }).snapshot_id : null;
  if (!result.ok || typeof snapshotId !== "string" || !snapshotId) {
    return { status: "error", message: `Bright Data no arrancó la búsqueda (${result.status}).` };
  }
  return { status: "triggered", snapshotId };
}

export async function pollSocialSearch(
  snapshotId: string,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: "pending" } | { status: "ready"; hits: SocialHit[] } | { status: "error"; message: string }> {
  if (!env.BRIGHT_DATA_API_KEY) return { status: "error", message: "Faltan credenciales de Bright Data." };
  const progress = await brightFetch(`/datasets/v3/progress/${encodeURIComponent(snapshotId)}`, env, { method: "GET" }, fetchImpl);
  const state = progress.body && typeof progress.body === "object" ? (progress.body as { status?: unknown }).status : null;
  if (!progress.ok || state === "failed" || state === "canceled") {
    return { status: "error", message: `Bright Data no completó la búsqueda (${progress.status}).` };
  }
  if (state !== "ready") return { status: "pending" };
  const snapshot = await brightFetch(`/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?format=json`, env, { method: "GET" }, fetchImpl);
  if (!snapshot.ok) return { status: "error", message: `Bright Data no entregó el resultado (${snapshot.status}).` };
  return { status: "ready", hits: readSocialHits(snapshot.body) };
}
