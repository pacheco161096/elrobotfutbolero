import pg from "pg";

const METRIC_KEYS = ["likes", "comments", "shares", "reactions", "reach", "clicks", "impressions"];

export function readZernioSignal(body: unknown): { externalId: string | null; engagement: Record<string, number> } {
  const engagement: Record<string, number> = {};
  let externalId: string | null = null;
  const visit = (value: unknown, key: string | null): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 8)) visit(item, key);
      return;
    }
    for (const [name, child] of Object.entries(value as Record<string, unknown>)) {
      if (typeof child === "number" && METRIC_KEYS.includes(name) && Number.isFinite(child)) engagement[name] = child;
      if (typeof child === "string" && !externalId && (name === "postId" || name === "facebookPostId" || name === "externalId" || (name === "_id" && (key === "post" || key === "data")))) {
        externalId = child.slice(0, 120);
      }
      if (child && typeof child === "object") visit(child, name);
    }
  };
  visit(body, null);
  return { externalId, engagement };
}

export async function learnFromWebhook(
  body: unknown,
  env: Record<string, string | undefined> = process.env,
): Promise<{ updated: number }> {
  const databaseUrl = env.DATABASE_URL;
  const signal = readZernioSignal(body);
  if (!databaseUrl || !signal.externalId || Object.keys(signal.engagement).length === 0) return { updated: 0 };
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const posts = await client.query<{ idempotency_key: string }>(
      `UPDATE posts
       SET engagement = COALESCE(engagement, '{}'::jsonb) || $2::jsonb
       WHERE facebook_post_id = $1
       RETURNING idempotency_key`,
      [signal.externalId, JSON.stringify(signal.engagement)],
    );
    for (const post of posts.rows) {
      await client.query(
        `UPDATE bot_memory
         SET content = content || $2::jsonb
         WHERE scope = 'publicacion' AND memory_key = $1`,
        [post.idempotency_key, JSON.stringify({ engagement: signal.engagement })],
      );
    }
    return { updated: posts.rowCount ?? 0 };
  } finally {
    await client.end();
  }
}
