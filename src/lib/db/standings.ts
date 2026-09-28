import pg from "pg";

export type Standing = {
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

export async function listStandings(databaseUrl = process.env.DATABASE_URL): Promise<Standing[]> {
  if (!databaseUrl) return [];
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<{
      rank: number;
      team: string;
      played: number | null;
      won: number | null;
      draw: number | null;
      lost: number | null;
      goals_for: number | null;
      goals_against: number | null;
      points: number | null;
    }>(`SELECT rank, team, played, won, draw, lost, goals_for, goals_against, points FROM standings ORDER BY rank, team`);
    return result.rows.map((row) => ({
      rank: row.rank,
      team: row.team,
      played: row.played,
      won: row.won,
      draw: row.draw,
      lost: row.lost,
      goalsFor: row.goals_for,
      goalsAgainst: row.goals_against,
      points: row.points,
    }));
  } catch {
    return [];
  } finally {
    await client.end();
  }
}
