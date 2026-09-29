import { statusFromApi, type MatchStatus } from "@/lib/engines/match-state";

export const API_FOOTBALL_HOST = "v3.football.api-sports.io";
export const LIGA_MX_LEAGUE_ID = 262;
export const UEFA_NATIONS_LEAGUE_ID = 5;
export const MEXICO_MEN_TEAM_ID = 16;
export const COVERED_LEAGUE_IDS = [LIGA_MX_LEAGUE_ID, UEFA_NATIONS_LEAGUE_ID] as const;

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
  league?: { id?: number; name?: string; season?: number };
  teams?: { home?: { id?: number; name?: string }; away?: { id?: number; name?: string } };
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

export function isMexicoMenFixture(raw: FixturePayload): boolean {
  return raw.teams?.home?.id === MEXICO_MEN_TEAM_ID || raw.teams?.away?.id === MEXICO_MEN_TEAM_ID;
}

export function coversFixture(raw: FixturePayload): boolean {
  const leagueId = raw.league?.id;
  if (leagueId != null && (COVERED_LEAGUE_IDS as readonly number[]).includes(leagueId)) return true;
  return isMexicoMenFixture(raw);
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

export function teamFixturesUrl(
  input: { teamId: number; from: string; to: string; season: number },
  host = API_FOOTBALL_HOST,
): string {
  const params = new URLSearchParams({
    team: String(input.teamId),
    season: String(input.season),
    from: input.from,
    to: input.to,
  });
  return `https://${host}/fixtures?${params.toString()}`;
}

export async function fetchTeamFixtures(
  input: { teamId: number; from: string; to: string; season: number; key: string; host?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ matches: StoredMatch[]; error: string | null }> {
  return readFixtures(teamFixturesUrl(input, input.host), input.key, fetchImpl);
}

export async function fetchFixtures(
  input: { from: string; to: string; season: number; key: string; host?: string; leagueId?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<{ matches: StoredMatch[]; error: string | null }> {
  return readFixtures(fixturesUrl(input, input.host), input.key, fetchImpl);
}

export function coveredLiveFixturesUrl(host = API_FOOTBALL_HOST): string {
  return `https://${host}/fixtures?live=all`;
}

export function liveFixturesUrl(
  leagueId = LIGA_MX_LEAGUE_ID,
  host = API_FOOTBALL_HOST,
  season = new Date().getUTCFullYear(),
): string {
  const params = new URLSearchParams({
    league: String(leagueId),
    season: String(season),
    live: "all",
  });
  return `https://${host}/fixtures?${params.toString()}`;
}

export type StandingRow = {
  season: number;
  rank: number;
  team: string;
  played: number | null;
  won: number | null;
  draw: number | null;
  lost: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  points: number | null;
};

type StandingPayload = {
  rank?: number;
  points?: number;
  team?: { name?: string };
  all?: { played?: number; win?: number; draw?: number; lose?: number; goals?: { for?: number; against?: number } };
};

export function standingsUrl(season: number, leagueId = LIGA_MX_LEAGUE_ID, host = API_FOOTBALL_HOST): string {
  return `https://${host}/standings?league=${leagueId}&season=${season}`;
}

export function mapStandings(payload: unknown, season: number): StandingRow[] {
  const response = payload && typeof payload === "object" ? (payload as { response?: Array<{ league?: { standings?: StandingPayload[][] } }> }).response : undefined;
  const groups = response?.[0]?.league?.standings ?? [];
  const rows: StandingRow[] = [];
  for (const group of groups) {
    for (const item of group) {
      const team = item.team?.name;
      if (!team || item.rank == null) continue;
      rows.push({
        season,
        rank: item.rank,
        team,
        played: item.all?.played ?? null,
        won: item.all?.win ?? null,
        draw: item.all?.draw ?? null,
        lost: item.all?.lose ?? null,
        goalsFor: item.all?.goals?.for ?? null,
        goalsAgainst: item.all?.goals?.against ?? null,
        points: item.points ?? null,
      });
    }
  }
  return rows.sort((left, right) => left.rank - right.rank);
}

export async function fetchStandings(
  input: { season: number; key: string; host?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ rows: StandingRow[]; error: string | null }> {
  const response = await fetchImpl(standingsUrl(input.season, LIGA_MX_LEAGUE_ID, input.host), { headers: { "x-apisports-key": input.key } });
  const body = (await response.json()) as { errors?: Record<string, string> | string[] };
  const errors = body.errors;
  const errorText = Array.isArray(errors) ? errors.join(" ") : errors ? Object.values(errors).join(" ") : "";
  if (!response.ok || errorText) return { rows: [], error: errorText || `HTTP ${response.status}` };
  return { rows: mapStandings(body, input.season), error: null };
}

export async function fetchLiveFixtures(
  input: { key: string; host?: string; leagueIds?: readonly number[] },
  fetchImpl: typeof fetch = fetch,
): Promise<{ matches: StoredMatch[]; error: string | null }> {
  const allowed = new Set(input.leagueIds ?? COVERED_LEAGUE_IDS);
  const result = await readFixtures(coveredLiveFixturesUrl(input.host), input.key, fetchImpl);
  return {
    ...result,
    matches: result.matches.filter((match) => {
      const raw = match.raw as FixturePayload;
      if (isMexicoMenFixture(raw)) return true;
      const id = raw.league?.id;
      return id != null && allowed.has(id);
    }),
  };
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

export function mapLiveEvent(event: LiveEventInput): { eventType: string; minute: number | null; player: string | null; team: string | null; detail: string | null; idempotencyKey: string } | null {
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
  return { eventType, minute, player, team, detail: event.detail ?? null, idempotencyKey };
}
