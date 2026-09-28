import pg from "pg";
import { getOverrides, refreshOverrides } from "@/lib/control/overrides";
import { imageForPost } from "@/lib/engines/visual";
import { previaDraft } from "@/lib/integrations/previa";
import { publishWithZernio, zernioGate } from "@/lib/integrations/gates";
import { applyVoice } from "@/lib/integrations/openai-voice";

const LIVE = ["PRE_MATCH", "LIVE", "HALFTIME", "SUSPENDED", "STALE"];

function blockedText(body: string, lists: string[][]): string | null {
  const text = body.toLowerCase();
  for (const list of lists) {
    const hit = list.find((item) => item && text.includes(item.toLowerCase()));
    if (hit) return hit;
  }
  return null;
}

async function remember(client: pg.Client, key: string, content: unknown): Promise<void> {
  await client.query(
    `INSERT INTO bot_memory (scope, memory_key, content)
     VALUES ('publicacion', $1, $2::jsonb)
     ON CONFLICT (scope, memory_key) DO UPDATE SET content = EXCLUDED.content`,
    [key, JSON.stringify(content)],
  );
}

export async function publishReadyPosts(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ published: number; pending: number }> {
  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl) await refreshOverrides(databaseUrl);
  const overrides = getOverrides();
  if (!databaseUrl || overrides.pauseAll || overrides.pausePublishing) return { published: 0, pending: 0 };
  if (zernioGate(env).status !== "ready") return { published: 0, pending: 0 };
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  let published = 0;
  let pending = 0;
  try {
    const posts = await client.query<{
      id: string;
      idempotency_key: string;
      body: string;
      kind: string;
      facts: { imageUrl?: string | null };
      club: string | null;
      format: string | null;
      tone: string | null;
      image_mode: string | null;
    }>(
      `SELECT p.id::text, p.idempotency_key, p.body, p.kind, p.facts, p.club, p.format, p.tone, p.image_mode
       FROM posts p
       LEFT JOIN stories s ON s.id = p.story_id
       LEFT JOIN matches m ON m.fixture_id = s.fixture_id
       WHERE p.facebook_post_id IS NULL
         AND p.body IS NOT NULL
         AND p.status IN ('queued', 'pending_credentials')
         AND (p.kind = 'PREVIA' OR m.status = ANY($1::text[]))
         AND (SELECT count(*) FROM post_attempts a WHERE a.post_id = p.id AND a.status = 'error') < 2
       ORDER BY p.created_at
       LIMIT 5`,
      [LIVE],
    );
    for (const post of posts.rows) {
      if (blockedText(post.body, [overrides.blockedWords, overrides.blockedPeople, overrides.blockedTopics])) {
        await client.query(`UPDATE posts SET status = 'blocked' WHERE id = $1`, [post.id]);
        continue;
      }
      const facts = typeof post.facts === "string" ? JSON.parse(post.facts) as { imageUrl?: string | null } : post.facts;
      const imageUrl = imageForPost(post.kind, facts?.imageUrl, overrides.pauseImages);
      const sent = await publishWithZernio({ idempotencyKey: post.idempotency_key, text: post.body, imageUrl }, env, fetchImpl);
      if (sent.status === "error") {
        await client.query(
          `INSERT INTO post_attempts (post_id, idempotency_key, status, error) VALUES ($1, $2, 'error', $3)`,
          [post.id, post.idempotency_key, sent.message],
        );
        continue;
      }
      if (sent.status !== "sent") {
        pending += 1;
        continue;
      }
      await client.query(
        `UPDATE posts SET status = 'published', facebook_post_id = $2, published_at = now() WHERE id = $1`,
        [post.id, sent.externalId],
      );
      await client.query(
        `INSERT INTO post_attempts (post_id, idempotency_key, external_id, status) VALUES ($1, $2, $3, 'sent')`,
        [post.id, post.idempotency_key, sent.externalId],
      );
      await remember(client, post.idempotency_key, {
        kind: post.kind,
        body: post.body,
        externalId: sent.externalId,
        club: post.club,
        format: post.format,
        tone: post.tone,
        imageMode: imageUrl ? post.image_mode : "texto",
        publishedAt: new Date().toISOString(),
      });
      published += 1;
    }
  } finally {
    await client.end();
  }
  return { published, pending };
}

export async function runPreMatchPosts(
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
): Promise<number> {
  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl) await refreshOverrides(databaseUrl);
  const overrides = getOverrides();
  if (!databaseUrl || overrides.pauseAll || overrides.pausePublishing) return 0;
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  let created = 0;
  try {
    const matches = await client.query<{ fixture_id: string; home_team: string; away_team: string; kickoff_at: Date }>(
      `SELECT m.fixture_id, m.home_team, m.away_team, m.kickoff_at
       FROM matches m
       WHERE m.status = 'PRE_MATCH'
         AND m.kickoff_at IS NOT NULL
         AND m.kickoff_at > $1
         AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.idempotency_key = 'previa:' || m.fixture_id)`,
      [now],
    );
    for (const match of matches.rows) {
      const voiced = await applyVoice(previaDraft({ home: match.home_team, away: match.away_team, kickoff: match.kickoff_at }), env);
      await client.query(
        `INSERT INTO posts (kind, idempotency_key, body, facts, tone, image_mode, status, format)
         VALUES ('PREVIA', $1, $2, '{}'::jsonb, 'normal', 'texto', 'queued', 'texto')
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [`previa:${match.fixture_id}`, voiced.text],
      );
      created += 1;
    }
  } finally {
    await client.end();
  }
  return created;
}
