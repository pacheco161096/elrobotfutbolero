import pg from "pg";

export type ListedMatch = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  kickoffAt: string | null;
  minute: number | null;
  round: string | null;
  league: string | null;
};

function presentMatch(row: MatchRow): ListedMatch {
  return {
    fixtureId: row.fixture_id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeScore: row.home_score,
    awayScore: row.away_score,
    status: row.status,
    kickoffAt: row.kickoff_at ? row.kickoff_at.toISOString() : null,
    minute: row.minute,
    round: row.round,
    league: row.league,
  };
}

type MatchRow = {
  fixture_id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  kickoff_at: Date | null;
  minute: number | null;
  round: string | null;
  league: string | null;
};

export async function listTeamMatches(team: string, databaseUrl = process.env.DATABASE_URL): Promise<ListedMatch[]> {
  if (!databaseUrl) return [];
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<MatchRow>(`
      SELECT fixture_id, home_team, away_team, home_score, away_score, status, kickoff_at, minute, league,
             raw->'league'->>'round' AS round
      FROM matches
      WHERE home_team = $1 OR away_team = $1
      ORDER BY kickoff_at NULLS LAST, home_team
    `, [team]);
    return result.rows.map(presentMatch);
  } finally {
    await client.end();
  }
}

export async function listMatches(databaseUrl = process.env.DATABASE_URL, league?: string): Promise<ListedMatch[]> {
  if (!databaseUrl) return [];
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<MatchRow>(`
      SELECT fixture_id, home_team, away_team, home_score, away_score, status, kickoff_at, minute, league,
             raw->'league'->>'round' AS round
      FROM matches
      WHERE ($1::text IS NULL OR league = $1)
      ORDER BY kickoff_at NULLS LAST, home_team
    `, [league ?? null]);
    return result.rows.map(presentMatch);
  } finally {
    await client.end();
  }
}
