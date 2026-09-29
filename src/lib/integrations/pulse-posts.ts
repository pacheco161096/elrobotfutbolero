import pg from "pg";
import { getOverrides, refreshOverrides } from "@/lib/control/overrides";
import { mentionsMatch } from "@/lib/engines/context";
import { contradictsScore, openMomentSituation, pulseSituation, quietSlot, readPulse } from "@/lib/engines/match-pulse";
import { boardNames, boardSituation } from "@/lib/engines/scoreboard";
import { teamSpoken } from "@/lib/engines/team-names";
import { brightDataMissing, facebookPageUrls, pollSocialSearch, triggerSocialSearch } from "@/lib/integrations/bright-data";
import { fetchMatchSides } from "@/lib/integrations/fixture-stats";
import { reinterpretPage, writeBoardLine, writeMomentLine } from "@/lib/integrations/openai-voice";
import { searchMatchImage } from "@/lib/integrations/web-image";

const RELEVANT = ["GOAL", "RED_CARD", "PENALTY", "MISSED_PENALTY", "VAR"];

type LiveMatch = {
  fixture_id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  minute: number | null;
};

async function openClient(databaseUrl: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

async function recentLines(client: pg.Client): Promise<string[]> {
  const result = await client.query<{ body: string }>(
    `SELECT body FROM posts
     WHERE body IS NOT NULL AND kind IN ('PULSE', 'HALFTIME', 'FULL_TIME', 'KICKOFF', 'FLASH')
     ORDER BY created_at DESC
     LIMIT 12`,
  );
  return result.rows.map((row) => row.body);
}

async function hasRelevantEvent(client: pg.Client, fixtureId: string): Promise<boolean> {
  const result = await client.query(`SELECT 1 FROM match_events WHERE fixture_id = $1 AND event_type = ANY($2::text[]) LIMIT 1`, [
    fixtureId,
    RELEVANT,
  ]);
  return result.rowCount !== 0;
}

async function insertPost(
  client: pg.Client,
  input: { kind: string; key: string; body: string; imageUrl?: string | null; imageMode?: string },
): Promise<number> {
  const inserted = await client.query(
    `INSERT INTO posts (kind, idempotency_key, body, facts, tone, image_mode, status, format)
     VALUES ($1, $2, $3, $4::jsonb, 'normal', $5, 'queued', 'texto')
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      input.kind,
      input.key,
      input.body,
      JSON.stringify({ imageUrl: input.imageUrl ?? null }),
      input.imageUrl ? (input.imageMode ?? "bot_generada") : "texto",
    ],
  );
  return inserted.rowCount ?? 0;
}

async function runBoardPosts(
  phase: "medio" | "final",
  env: Record<string, string | undefined>,
): Promise<number> {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) return 0;
  await refreshOverrides(databaseUrl);
  const overrides = getOverrides();
  if (overrides.pauseAll || overrides.pausePublishing) return 0;
  const client = await openClient(databaseUrl);
  let created = 0;
  try {
    const matches = await client.query<LiveMatch>(
      phase === "medio"
        ? `SELECT fixture_id, home_team, away_team, home_score, away_score, status, minute
           FROM matches
           WHERE status = 'HALFTIME'
             AND home_score IS NOT NULL
             AND away_score IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.idempotency_key = 'halftime:' || matches.fixture_id)`
        : `SELECT fixture_id, home_team, away_team, home_score, away_score, status, minute
           FROM matches
           WHERE status = 'FT'
             AND home_score IS NOT NULL
             AND away_score IS NOT NULL
             AND kickoff_at > now() - interval '4 hours'
             AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.idempotency_key = 'fulltime:' || matches.fixture_id)`,
    );
    for (const match of matches.rows) {
      const goals = await client.query<{ minute: number | null }>(
        `SELECT minute, player, team FROM match_events WHERE fixture_id = $1 AND event_type = 'GOAL'`,
        [match.fixture_id],
      );
      const counted = goals.rows.filter((goal) => phase === "final" || goal.minute == null || goal.minute < 46);
      const names = boardNames(match.fixture_id, phase, match.home_team, match.away_team);
      const voice = await writeBoardLine({
        situation: boardSituation({
          phase,
          home: names.home,
          away: names.away,
          homeScore: match.home_score as number,
          awayScore: match.away_score as number,
          goalCount: counted.length,
        }),
        avoid: await recentLines(client),
        homeScore: match.home_score as number,
        awayScore: match.away_score as number,
      }, env);
      if (!voice.spoke || !voice.line) continue;
      if (phase === "medio") {
        created += await insertPost(client, {
          kind: "HALFTIME",
          key: `halftime:${match.fixture_id}`,
          body: voice.line,
        });
        continue;
      }
      if (overrides.pauseImages) continue;
      const image = await searchMatchImage({
        query: `${match.home_team} vs ${match.away_team} partido`,
        teams: [match.home_team, match.away_team],
        homeScore: match.home_score as number,
        awayScore: match.away_score as number,
      });
      if (!image) continue;
      created += await insertPost(client, {
        kind: "FULL_TIME",
        key: `fulltime:${match.fixture_id}`,
        body: voice.line,
        imageUrl: image,
        imageMode: "fotografia_real",
      });
    }
  } finally {
    await client.end();
  }
  return created;
}

export async function runHalftimePosts(env: Record<string, string | undefined> = process.env): Promise<number> {
  return runBoardPosts("medio", env);
}

export async function runFullTimePosts(env: Record<string, string | undefined> = process.env): Promise<number> {
  return runBoardPosts("final", env);
}

async function pageQuote(
  client: pg.Client,
  match: LiveMatch,
  env: Record<string, string | undefined>,
): Promise<{ status: "quote"; source: string; author: string } | { status: "waiting" } | { status: "none" }> {
  if (match.home_score == null || match.away_score == null) return { status: "none" };
  if (brightDataMissing(env).length) return { status: "none" };
  const jobKey = `pulse-pages:${match.fixture_id}`;
  const job = await client.query<{ status: string; payload: { snapshotId?: string } | null }>(
    `SELECT status, payload FROM jobs WHERE idempotency_key = $1`,
    [jobKey],
  );
  const snapshotId = job.rows[0]?.status === "running" ? job.rows[0].payload?.snapshotId : undefined;
  if (!snapshotId) {
    if (job.rows[0]?.status === "done") return { status: "none" };
    const pages = facebookPageUrls(env.BRIGHT_DATA_PAGE_URLS);
    const triggered = await triggerSocialSearch(pages, env);
    if (triggered.status !== "triggered") return { status: "none" };
    await client.query(
      `INSERT INTO jobs (type, priority, status, idempotency_key, payload, attempts)
       VALUES ('CONTEXT', 40, 'running', $1, $2::jsonb, 1)
       ON CONFLICT (idempotency_key) DO UPDATE
       SET status = 'running', payload = EXCLUDED.payload, updated_at = now()`,
      [jobKey, JSON.stringify({ snapshotId: triggered.snapshotId, fixtureId: match.fixture_id })],
    );
    return { status: "waiting" };
  }
  const polled = await pollSocialSearch(snapshotId, env);
  if (polled.status === "pending") return { status: "waiting" };
  if (polled.status !== "ready") {
    await client.query(`UPDATE jobs SET status = 'failed', updated_at = now() WHERE idempotency_key = $1`, [jobKey]);
    return { status: "none" };
  }
  await client.query(`UPDATE jobs SET status = 'done', updated_at = now() WHERE idempotency_key = $1`, [jobKey]);
  const teams = [match.home_team, match.away_team];
  const hit = polled.hits.find((item) => {
    return mentionsMatch(item.text, teams) && !contradictsScore(item.text, match.home_score as number, match.away_score as number);
  });
  if (!hit) return { status: "none" };
  return {
    status: "quote",
    source: hit.text,
    author: hit.author?.trim() || "publicación pública",
  };
}

export async function runQuietPosts(env: Record<string, string | undefined> = process.env): Promise<number> {
  const databaseUrl = env.DATABASE_URL;
  const key = env.API_FOOTBALL_KEY;
  if (!databaseUrl || !key) return 0;
  await refreshOverrides(databaseUrl);
  const overrides = getOverrides();
  if (overrides.pauseAll || overrides.pausePublishing) return 0;
  const client = await openClient(databaseUrl);
  let created = 0;
  try {
    const matches = await client.query<LiveMatch>(
      `SELECT fixture_id, home_team, away_team, home_score, away_score, status, minute
       FROM matches
       WHERE status = 'LIVE'`,
    );
    for (const match of matches.rows) {
      if (await hasRelevantEvent(client, match.fixture_id)) continue;
      const posts = await client.query<{ idempotency_key: string; body: string }>(
        `SELECT idempotency_key, body FROM posts
         WHERE idempotency_key LIKE $1 OR idempotency_key = $2`,
        [`pulse:${match.fixture_id}:%`, `halftime:${match.fixture_id}`],
      );
      const taken = {
        first: posts.rows.some((row) => row.idempotency_key.endsWith(":1")),
        second: posts.rows.some((row) => row.idempotency_key.endsWith(":2")),
      };
      const slot = quietSlot(match.minute, taken);
      if (!slot) continue;
      if (slot === 2) {
        const quote = await pageQuote(client, match, env);
        if (quote.status === "quote") {
          const line = await reinterpretPage({
            source: quote.source,
            author: quote.author,
            situation: `Partido en curso entre ${teamSpoken(match.home_team, `${match.fixture_id}:cita:home`)} y ${teamSpoken(match.away_team, `${match.fixture_id}:cita:away`)}, minuto ${match.minute ?? "sin confirmar"}. No hay un evento nuevo. Nómbralos así, en español. Si el texto ajeno no aporta un ángulo, responde NADA.`,
          }, env);
          if (line) {
            if (overrides.pauseImages) continue;
            const image = await searchMatchImage({
              query: `${match.home_team} vs ${match.away_team} partido`,
              teams: [match.home_team, match.away_team],
              homeScore: match.home_score,
              awayScore: match.away_score,
            });
            if (!image) continue;
            created += await insertPost(client, {
              kind: "PULSE",
              key: `pulse:${match.fixture_id}:2`,
              body: line,
              imageUrl: image,
              imageMode: "fotografia_real",
            });
            continue;
          }
        }
        if (quote.status === "waiting" && (match.minute ?? 0) < 80) continue;
      }
      const sides = await fetchMatchSides({
        fixtureId: match.fixture_id,
        home: match.home_team,
        away: match.away_team,
        key,
        host: env.API_FOOTBALL_HOST,
      });
      const kind = sides ? readPulse(sides.home, sides.away) : null;
      if (!kind || match.home_score == null || match.away_score == null) continue;
      if (slot === 1) await pageQuote(client, match, env);
      const voice = await writeMomentLine({
        situation: pulseSituation({
          home: teamSpoken(match.home_team, `${match.fixture_id}:pulso:home`),
          away: teamSpoken(match.away_team, `${match.fixture_id}:pulso:away`),
          minute: match.minute,
          kind,
          homeScore: match.home_score as number,
          awayScore: match.away_score as number,
          place: "pulso",
        }),
        avoid: await recentLines(client),
        minute: match.minute,
      }, env);
      if (!voice.spoke || !voice.line || overrides.pauseImages) continue;
      const image = await searchMatchImage({
        query: `${match.home_team} vs ${match.away_team} partido`,
        teams: [match.home_team, match.away_team],
        homeScore: match.home_score,
        awayScore: match.away_score,
      });
      if (!image) continue;
      created += await insertPost(client, {
        kind: "PULSE",
        key: `pulse:${match.fixture_id}:${slot}`,
        body: voice.line,
        imageUrl: image,
        imageMode: "fotografia_real",
      });
    }
  } finally {
    await client.end();
  }
  return created;
}
