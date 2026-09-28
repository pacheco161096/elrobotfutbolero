import pg from "pg";

export type StoredNote = {
  id: string;
  title: string;
  body: string | null;
  updatedAt: string;
};

export async function listNotes(databaseUrl = process.env.DATABASE_URL): Promise<StoredNote[]> {
  if (!databaseUrl) return [];
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<{ id: string; title: string; body: string | null; updated_at: Date }>(`
      SELECT s.id::text, s.title, p.body, s.updated_at
      FROM stories s
      LEFT JOIN LATERAL (
        SELECT body FROM posts WHERE story_id = s.id AND body IS NOT NULL ORDER BY created_at DESC LIMIT 1
      ) p ON true
      WHERE s.status IN ('PUBLISH_NOW', 'PUBLISH_CONTEXT')
      ORDER BY s.updated_at DESC
      LIMIT 30
    `);
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      updatedAt: row.updated_at.toISOString(),
    }));
  } catch {
    return [];
  } finally {
    await client.end();
  }
}
