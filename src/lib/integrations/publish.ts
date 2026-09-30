import pg from "pg";
import { getOverrides, refreshOverrides } from "@/lib/control/overrides";
import { allowsCronPost, cronHalf, type Half } from "@/lib/engines/cron-budget";
import { imageForPost } from "@/lib/engines/visual";
import { publishWithZernio, zernioGate } from "@/lib/integrations/gates";

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

type PostFacts = { imageUrl?: string | null; consensus?: boolean };

function readFacts(value: unknown): PostFacts {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as PostFacts;
    } catch {
      return {};
    }
  }
  return value as PostFacts;
}

async function usedHalves(client: pg.Client, fixtureId: string, cache: Map<string, { primero: boolean; segundo: boolean }>): Promise<{ primero: boolean; segundo: boolean }> {
  const cached = cache.get(fixtureId);
  if (cached) return cached;
  const result = await client.query<{ half: string | null }>(
    `SELECT facts->>'half' AS half FROM posts
     WHERE status = 'published' AND facts->>'via' = 'football-engine' AND facts->>'fixtureId' = $1`,
    [fixtureId],
  );
  const slot = {
    primero: result.rows.some((row) => row.half === "primero"),
    segundo: result.rows.some((row) => row.half === "segundo"),
  };
  cache.set(fixtureId, slot);
  return slot;
}

export async function publishReadyPosts(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
  options: { perMatchHalf?: boolean } = {},
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
      facts: PostFacts | string | null;
      club: string | null;
      format: string | null;
      tone: string | null;
      image_mode: string | null;
      fixture_id: string | null;
      minute: number | null;
      home_score: number | null;
      away_score: number | null;
      match_status: string | null;
      event_minute: number | null;
    }>(
      `SELECT p.id::text, p.idempotency_key, p.body, p.kind, p.facts, p.club, p.format, p.tone, p.image_mode,
              COALESCE(s.fixture_id, CASE
                WHEN split_part(p.idempotency_key, ':', 1) IN ('fulltime', 'halftime', 'pulse')
                THEN split_part(p.idempotency_key, ':', 2)
              END) AS fixture_id,
              m.minute, m.home_score, m.away_score, m.status AS match_status, e.minute AS event_minute
       FROM posts p
       LEFT JOIN stories s ON s.id = p.story_id
       LEFT JOIN match_events e ON e.id = p.event_id
       LEFT JOIN matches m ON m.fixture_id = COALESCE(s.fixture_id, CASE
         WHEN split_part(p.idempotency_key, ':', 1) IN ('fulltime', 'halftime', 'pulse')
         THEN split_part(p.idempotency_key, ':', 2)
       END)
       WHERE p.facebook_post_id IS NULL
         AND p.body IS NOT NULL
         AND p.status IN ('queued', 'pending_credentials')
         AND p.kind NOT IN ('PREVIA', 'KICKOFF')
         AND (p.kind IN ('HALFTIME', 'FULL_TIME', 'PULSE') OR m.status = ANY($1::text[]))
         AND (SELECT count(*) FROM post_attempts a WHERE a.post_id = p.id AND a.status = 'error') < 2
       ORDER BY p.created_at
       LIMIT $2`,
      [LIVE, options.perMatchHalf ? 30 : 5],
    );
    const halves = new Map<string, { primero: boolean; segundo: boolean }>();
    for (const post of posts.rows) {
      if (published >= 5) break;
      if (blockedText(post.body, [overrides.blockedWords, overrides.blockedPeople, overrides.blockedTopics])) {
        await client.query(`UPDATE posts SET status = 'blocked' WHERE id = $1`, [post.id]);
        continue;
      }
      const facts = readFacts(post.facts);
      let half: Half | null = null;
      if (options.perMatchHalf) {
        half = cronHalf({
          kind: post.kind,
          key: post.idempotency_key,
          minute: post.event_minute ?? post.minute,
          status: post.match_status,
        });
        const slot = post.fixture_id ? await usedHalves(client, post.fixture_id, halves) : { primero: false, segundo: false };
        const allowed = Boolean(post.fixture_id) && allowsCronPost({
          half,
          usedFirst: slot.primero,
          usedSecond: slot.segundo,
          homeScore: post.home_score,
          awayScore: post.away_score,
          consensus: facts.consensus === true,
        });
        if (!allowed) continue;
      }
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
        `UPDATE posts
         SET status = 'published', facebook_post_id = $2, published_at = now(),
             facts = COALESCE(facts, '{}'::jsonb) || $3::jsonb
         WHERE id = $1`,
        [post.id, sent.externalId, JSON.stringify({
          via: options.perMatchHalf ? "football-engine" : undefined,
          half: options.perMatchHalf ? half : undefined,
          fixtureId: options.perMatchHalf ? post.fixture_id : undefined,
        })],
      );
      if (options.perMatchHalf && post.fixture_id && half) {
        const slot = halves.get(post.fixture_id);
        if (slot) slot[half] = true;
      }
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
