import { statusFromApi, type MatchStatus } from "@/lib/engines/match-state";

export const API_FOOTBALL_HOST = "v3.football.api-sports.io";
export const LIGA_MX_LEAGUE_ID = 262;

export type StoredMatch = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  kickoffAt: string | null;
  league: string;
  minute: number | null;
  raw: unknown;
};

type FixturePayload = {
  fixture?: { id?: number; date?: string; status?: { short?: string; elapsed?: number | null } };
  league?: { name?: string; season?: number };
  teams?: { home?: { name?: string }; away?: { name?: string } };
  goals?: { home?: number | null; away?: number | null };
};

export function mapFixture(raw: FixturePayload, now: Date): StoredMatch | null {
  const id = raw.fixture?.id;
  const home = raw.teams?.home?.name;
  const away = raw.teams?.away?.name;
  const short = raw.fixture?.status?.short;
  if (id == null || !home || !away || !short) return null;
  const kickoffAt = raw.fixture?.date ?? null;
  const status = statusFromApi(short, kickoffAt, now);
  if (!status) return null;
  return {
    fixtureId: String(id),
    homeTeam: home,
    awayTeam: away,
    homeScore: raw.goals?.home ?? null,
    awayScore: raw.goals?.away ?? null,
    status,
    kickoffAt,
    league: raw.league?.name ?? "Liga MX",
    minute: raw.fixture?.status?.elapsed ?? null,
    raw,
  };
}

export function fixturesUrl(input: { from: string; to: string; season: number; leagueId?: number }, host = API_FOOTBALL_HOST): string {
  const params = new URLSearchParams({
    league: String(input.leagueId ?? LIGA_MX_LEAGUE_ID),
    season: String(input.season),
    from: input.from,
    to: input.to,
  });
  return `https://${host}/fixtures?${params.toString()}`;
}

async function readFixtures(url: string, key: string, fetchImpl: typeof fetch): Promise<{ matches: StoredMatch[]; error: string | null }> {
  const response = await fetchImpl(url, { headers: { "x-apisports-key": key } });
  const body = (await response.json()) as { response?: FixturePayload[]; errors?: Record<string, string> | string[] };
  const errors = body.errors;
  const errorText = Array.isArray(errors) ? errors.join(" ") : errors ? Object.values(errors).join(" ") : "";
  if (!response.ok || errorText) return { matches: [], error: errorText || `HTTP ${response.status}` };
  const now = new Date();
  return { matches: (body.response ?? []).map((item) => mapFixture(item, now)).filter((item): item is StoredMatch => Boolean(item)), error: null };
}

export async function fetchFixtures(
  input: { from: string; to: string; season: number; key: string; host?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ matches: StoredMatch[]; error: string | null }> {
  return readFixtures(fixturesUrl(input, input.host), input.key, fetchImpl);
}

export function liveFixturesUrl(leagueId = LIGA_MX_LEAGUE_ID, host = API_FOOTBALL_HOST): string {
  return `https://${host}/fixtures?live=${leagueId}`;
}

export async function fetchLiveFixtures(
  input: { key: string; host?: string; leagueId?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<{ matches: StoredMatch[]; error: string | null }> {
  return readFixtures(liveFixturesUrl(input.leagueId, input.host), input.key, fetchImpl);
}

export type LiveEventInput = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  time?: { elapsed?: number | null };
  team?: { name?: string };
  player?: { name?: string };
  type?: string;
  detail?: string;
};

export function mapLiveEvent(event: LiveEventInput): { eventType: string; minute: number | null; player: string | null; team: string | null; idempotencyKey: string } | null {
  const type = (event.type ?? "").toLowerCase();
  const detail = (event.detail ?? "").toLowerCase();
  let eventType: string | null = null;
  if (detail.includes("missed penalty")) eventType = "MISSED_PENALTY";
  else if (type === "goal") eventType = "GOAL";
  else if (type === "card" && detail.includes("red")) eventType = "RED_CARD";
  else if (type === "card") eventType = "YELLOW_CARD";
  else if (type === "subst" || type === "substitution") eventType = "SUBSTITUTION";
  else if (type === "var") eventType = "VAR";
  if (!eventType) return null;
  const minute = event.time?.elapsed ?? null;
  const player = event.player?.name ?? null;
  const team = event.team?.name ?? null;
  const idempotencyKey = ["fx", event.fixtureId, eventType, minute ?? "x", player ?? "x", team ?? "x"].join(":");
  return { eventType, minute, player, team, idempotencyKey };
}
