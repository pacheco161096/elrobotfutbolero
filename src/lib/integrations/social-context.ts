import pg from "pg";
import { getOverrides, refreshOverrides } from "@/lib/control/overrides";
import { mentionsMatch, reviewSocialHits } from "@/lib/engines/context";
import { pickExpression } from "@/lib/engines/copy";
import { imageRoute, matchImageQuery, memeScene } from "@/lib/engines/image-route";
import { teamSpoken } from "@/lib/engines/team-names";
import { brightDataMissing, facebookPageUrls, pollSocialSearch, triggerSocialSearch } from "@/lib/integrations/bright-data";
import { reinterpretPage } from "@/lib/integrations/openai-voice";
import { generateRobotImage } from "@/lib/integrations/robot-image";
import { searchMatchImage } from "@/lib/integrations/web-image";

const CONTEXT_EVENTS = ["GOAL", "RED_CARD", "PENALTY", "MISSED_PENALTY", "VAR", "HALFTIME", "FULL_TIME", "SUSPENDED"];

type Candidate = {
  story_id: string;
  story_key: string;
  title: string;
  last_event_type: string;
  home_team: string;
  away_team: string;
  job_id: string | null;
  job_status: string | null;
  attempts: number | null;
  payload: { snapshotId?: string } | null;
};

export type SocialContextResult = {
  status: "idle" | "pending_credentials" | "triggered" | "pending" | "ready" | "error";
  checked: number;
  decision?: "DISCARD" | "MONITOR";
  missing?: string[];
  message?: string;
};

async function loadCandidate(client: pg.Client, now: Date): Promise<Candidate | null> {
  const since = new Date(now.getTime() - 30 * 60 * 1000);
  const result = await client.query<Candidate>(
    `SELECT s.id::text AS story_id, s.story_key, s.title, s.last_event_type, m.home_team, m.away_team,
            j.id::text AS job_id, j.status AS job_status, j.attempts, j.payload
     FROM stories s
     JOIN matches m ON m.fixture_id = s.fixture_id
     LEFT JOIN jobs j ON j.idempotency_key = 'bright:' || s.story_key
     WHERE s.updated_at > $1
       AND s.last_event_type = ANY($2::text[])
       AND (j.status IS NULL OR j.status = 'running' OR (j.status = 'failed' AND j.attempts < 2))
     ORDER BY s.updated_at ASC
     LIMIT 1`,
    [since, CONTEXT_EVENTS],
  );
  return result.rows[0] ?? null;
}

async function knownClaims(client: pg.Client, storyId: string, title: string): Promise<string[]> {
  const claims = await client.query<{ claim: string }>(`SELECT claim FROM claims WHERE story_id = $1`, [storyId]);
  return [title, ...claims.rows.map((row) => row.claim)];
}

async function saveReview(
  client: pg.Client,
  storyId: string,
  review: ReturnType<typeof reviewSocialHits>,
): Promise<void> {
  for (const claim of review.claims) {
    const source = await client.query<{ id: string }>(
      `INSERT INTO sources (name, source_type, url) VALUES ($1, 'usuario', $2) RETURNING id::text`,
      [claim.author, claim.url],
    );
    const saved = await client.query<{ id: string }>(
      `INSERT INTO claims (story_id, claim, status, confidence) VALUES ($1, $2, 'UNCONFIRMED', 'AFIRMACION_DE_UNA_FUENTE') RETURNING id::text`,
      [storyId, claim.text],
    );
    await client.query(
      `INSERT INTO claim_sources (claim_id, source_id, stance) VALUES ($1, $2, 'apoya') ON CONFLICT DO NOTHING`,
      [saved.rows[0].id, source.rows[0].id],
    );
  }
  await client.query(
    `INSERT INTO editorial_decisions (story_id, decision, reason, confidence, source_count, contradiction_status)
     VALUES ($1, $2, $3, 'AFIRMACION_DE_UNA_FUENTE', $4, 'AFIRMACION_DE_UNA_FUENTE')`,
    [storyId, review.decision, review.reason, review.claims.length],
  );
}

export async function runSocialContext(
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<SocialContextResult> {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) return { status: "idle", checked: 0 };
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const candidate = await loadCandidate(client, now);
    if (!candidate) return { status: "idle", checked: 0 };
    const missing = brightDataMissing(env);
    if (missing.length) return { status: "pending_credentials", checked: 1, missing };
    const pages = facebookPageUrls(env.BRIGHT_DATA_PAGE_URLS);
    const jobKey = `bright:${candidate.story_key}`;
    const snapshotId = candidate.job_status === "running" ? candidate.payload?.snapshotId : undefined;

    if (!snapshotId) {
      const triggered = await triggerSocialSearch(pages, env, fetchImpl);
      if (triggered.status !== "triggered") {
        const message = triggered.status === "error" ? triggered.message : "Faltan credenciales de Bright Data.";
        await client.query(
          `INSERT INTO jobs (type, priority, status, idempotency_key, payload, attempts, last_error)
           VALUES ('CONTEXT', 50, 'failed', $1, $2::jsonb, 1, $3)
           ON CONFLICT (idempotency_key) DO UPDATE
           SET status = 'failed', attempts = jobs.attempts + 1, last_error = EXCLUDED.last_error, updated_at = now()`,
          [jobKey, JSON.stringify({ urls: pages, storyId: candidate.story_id }), message],
        );
        return { status: "error", checked: 1, message };
      }
      await client.query(
        `INSERT INTO jobs (type, priority, status, idempotency_key, payload, attempts)
         VALUES ('CONTEXT', 50, 'running', $1, $2::jsonb, 1)
         ON CONFLICT (idempotency_key) DO UPDATE
         SET status = 'running', payload = EXCLUDED.payload, attempts = jobs.attempts + 1, last_error = NULL, updated_at = now()`,
        [jobKey, JSON.stringify({ urls: pages, storyId: candidate.story_id, snapshotId: triggered.snapshotId })],
      );
      return { status: "triggered", checked: 1 };
    }

    const polled = await pollSocialSearch(snapshotId, env, fetchImpl);
    if (polled.status === "pending") return { status: "pending", checked: 1 };
    if (polled.status === "error") {
      await client.query(`UPDATE jobs SET status = 'failed', last_error = $2, updated_at = now() WHERE idempotency_key = $1`, [
        jobKey,
        polled.message,
      ]);
      return { status: "error", checked: 1, message: polled.message };
    }
    const review = reviewSocialHits({ known: await knownClaims(client, candidate.story_id, candidate.title), hits: polled.hits });
    await saveReview(client, candidate.story_id, review);
    const related = review.claims.filter((claim) => mentionsMatch(claim.text, [candidate.home_team, candidate.away_team]));
    const pick = related[0];
    if (pick) {
      const line = await reinterpretPage({
        source: pick.text,
        author: pick.author,
        situation: `Reacción a lo que se dice de ${teamSpoken(candidate.home_team, `${candidate.story_key}:home`)} contra ${teamSpoken(candidate.away_team, `${candidate.story_key}:away`)}. El dato del marcador ya salió aparte. Nómbralos así, en español. Aquí solo cabe un ángulo propio.`,
      }, env, fetchImpl);
      if (line) {
        await refreshOverrides(databaseUrl);
        const route = imageRoute({ eventType: candidate.last_event_type, source: pick.text, line });
        const image = getOverrides().pauseImages
          ? null
          : route === "buscar"
            ? await searchMatchImage({
                query: matchImageQuery({ home: candidate.home_team, away: candidate.away_team, eventType: candidate.last_event_type }),
                teams: [candidate.home_team, candidate.away_team],
                avoid: pick.imageUrl,
              }, fetchImpl)
            : await generateRobotImage(
                pickExpression({ eventType: candidate.last_event_type, tone: "normal" }),
                env,
                fetchImpl,
                memeScene(line),
              );
        await client.query(
          `INSERT INTO posts (story_id, kind, idempotency_key, body, facts, tone, image_mode, status, format)
           VALUES ($1, 'CONTEXT', $2, $3, $4::jsonb, 'normal', $5, 'queued', 'texto')
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            candidate.story_id,
            `context-post:${candidate.story_key}`,
            line,
            JSON.stringify({ imageUrl: image }),
            image ? (route === "buscar" ? "fotografia_real" : "bot_generada") : "texto",
          ],
        );
      }
    }
    await client.query(`UPDATE jobs SET status = 'done', last_error = NULL, updated_at = now() WHERE idempotency_key = $1`, [jobKey]);
    return { status: "ready", checked: 1, decision: review.decision };
  } finally {
    await client.end();
  }
}
