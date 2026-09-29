import pg from "pg";
import { COVERED_LEAGUE_IDS, fetchFixtures, fetchStandings, fetchTeamFixtures, MEXICO_MEN_TEAM_ID, type StandingRow, type StoredMatch } from "@/lib/integrations/api-football";
import { syncWindow } from "@/lib/engines/match-state";

const UPSERT = `
INSERT INTO matches (
  fixture_id, home_team, away_team, home_score, away_score, status,
  kickoff_at, league, minute, last_polled_at, raw, updated_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10::jsonb,now())
ON CONFLICT (fixture_id) DO UPDATE SET
  home_team = EXCLUDED.home_team,
  away_team = EXCLUDED.away_team,
  home_score = EXCLUDED.home_score,
  away_score = EXCLUDED.away_score,
  status = EXCLUDED.status,
  kickoff_at = EXCLUDED.kickoff_at,
  league = EXCLUDED.league,
  minute = EXCLUDED.minute,
  last_polled_at = now(),
  raw = EXCLUDED.raw,
  updated_at = now()
`;

export async function saveMatches(databaseUrl: string, matches: StoredMatch[]): Promise<number> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const match of matches) {
      await client.query(UPSERT, [
        match.fixtureId,
        match.homeTeam,
        match.awayTeam,
        match.homeScore,
        match.awayScore,
        match.status,
        match.kickoffAt,
        match.league,
        match.minute,
        JSON.stringify(match.raw),
      ]);
    }
  } finally {
    await client.end();
  }
  return matches.length;
}

export async function syncLigaMx(env: Record<string, string | undefined> = process.env, now = new Date()): Promise<{ saved: number; error: string | null; window: { from: string; to: string } }> {
  const key = env.API_FOOTBALL_KEY;
  const databaseUrl = env.DATABASE_URL;
  const window = syncWindow(now);
  if (!key || !databaseUrl) return { saved: 0, error: "Faltan API_FOOTBALL_KEY o DATABASE_URL.", window };
  const season = now.getUTCFullYear();
  const matches: StoredMatch[] = [];
  const errors: string[] = [];
  for (const leagueId of COVERED_LEAGUE_IDS) {
    const fetched = await fetchFixtures({ ...window, season, key, host: env.API_FOOTBALL_HOST, leagueId });
    if (fetched.error) errors.push(fetched.error);
    else matches.push(...fetched.matches);
  }
  const mexico = await fetchTeamFixtures({
    teamId: MEXICO_MEN_TEAM_ID,
    ...window,
    season,
    key,
    host: env.API_FOOTBALL_HOST,
  });
  if (mexico.error) errors.push(mexico.error);
  else matches.push(...mexico.matches);
  if (!matches.length && errors.length) return { saved: 0, error: errors.join(" "), window };
  const seen = new Set<string>();
  const unique = matches.filter((match) => {
    if (seen.has(match.fixtureId)) return false;
    seen.add(match.fixtureId);
    return true;
  });
  const saved = await saveMatches(databaseUrl, unique);
  return { saved, error: errors[0] ?? null, window };
}

export async function saveStandings(databaseUrl: string, rows: StandingRow[]): Promise<number> {
  if (!rows.length) return 0;
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const season = rows[0].season;
    await client.query(`DELETE FROM standings WHERE season = $1`, [season]);
    for (const row of rows) {
      await client.query(
        `INSERT INTO standings (season, rank, team, played, won, draw, lost, goals_for, goals_against, points, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())`,
        [row.season, row.rank, row.team, row.played, row.won, row.draw, row.lost, row.goalsFor, row.goalsAgainst, row.points],
      );
    }
  } finally {
    await client.end();
  }
  return rows.length;
}

export async function syncStandings(env: Record<string, string | undefined> = process.env, now = new Date()): Promise<{ saved: number; error: string | null }> {
  const key = env.API_FOOTBALL_KEY;
  const databaseUrl = env.DATABASE_URL;
  if (!key || !databaseUrl) return { saved: 0, error: "Faltan API_FOOTBALL_KEY o DATABASE_URL." };
  const fetched = await fetchStandings({ season: now.getUTCFullYear(), key, host: env.API_FOOTBALL_HOST });
  if (fetched.error) return { saved: 0, error: fetched.error };
  return { saved: await saveStandings(databaseUrl, fetched.rows), error: null };
}
