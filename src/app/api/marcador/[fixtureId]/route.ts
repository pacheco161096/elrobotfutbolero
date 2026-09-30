import pg from "pg";
import { buildScoreCard, logoFromRaw, type ScoreGoalInput } from "@/lib/engines/score-card";
import { renderScoreCard } from "@/lib/integrations/score-card-png";

export const dynamic = "force-dynamic";

async function bytes(url: string): Promise<Buffer | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

export async function GET(_request: Request, context: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId } = await context.params;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !/^\d+$/.test(fixtureId)) return new Response("No está.", { status: 404 });
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const match = await client.query<{
      home_team: string;
      away_team: string;
      home_score: number | null;
      away_score: number | null;
      raw: unknown;
    }>(`SELECT home_team, away_team, home_score, away_score, raw FROM matches WHERE fixture_id = $1`, [fixtureId]);
    const row = match.rows[0];
    const post = await client.query<{ facts: { backgroundUrl?: string } }>(
      `SELECT facts FROM posts WHERE idempotency_key = $1`,
      [`fulltime:${fixtureId}`],
    );
    const goals = await client.query<ScoreGoalInput>(
      `SELECT minute, player, team, payload->>'detail' AS detail
       FROM match_events WHERE fixture_id = $1 AND event_type = 'GOAL'
       ORDER BY minute NULLS LAST, created_at`,
      [fixtureId],
    );
    const storedFacts = post.rows[0]?.facts;
    const facts = typeof storedFacts === "string" ? JSON.parse(storedFacts) as { backgroundUrl?: string } : storedFacts;
    const backgroundUrl = facts?.backgroundUrl;
    if (!row || !backgroundUrl?.startsWith("https://")) return new Response("No está.", { status: 404 });
    const card = buildScoreCard({
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      homeScore: row.home_score,
      awayScore: row.away_score,
      homeLogo: logoFromRaw(row.raw, "home"),
      awayLogo: logoFromRaw(row.raw, "away"),
      goals: goals.rows,
    });
    if (!card) return new Response("No está.", { status: 404 });
    const [photo, homeMark, awayMark] = await Promise.all([
      bytes(backgroundUrl),
      bytes(card.homeMarkUrl),
      bytes(card.awayMarkUrl),
    ]);
    if (!photo || !homeMark || !awayMark) return new Response("No está.", { status: 404 });
    const png = await renderScoreCard({
      photo,
      homeMark,
      awayMark,
      homeMarkKind: card.homeMark,
      awayMarkKind: card.awayMark,
      homeCode: card.homeCode,
      awayCode: card.awayCode,
      homeScore: card.homeScore,
      awayScore: card.awayScore,
      homeGoals: card.homeGoals,
      awayGoals: card.awayGoals,
    });
    return new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" },
    });
  } finally {
    await client.end();
  }
}
