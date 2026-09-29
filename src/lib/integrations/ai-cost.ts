import pg from "pg";

const PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
};

const IMAGE_USD: Record<string, number> = {
  "dall-e-3": 0.04,
  "gpt-image-1-mini": 0.02,
};

export function estimateUsd(model: string, promptTokens: number, completionTokens: number): number | null {
  const price = PER_MILLION[model];
  if (!price) return null;
  return (promptTokens * price.input + completionTokens * price.output) / 1_000_000;
}

export function imageUsd(model: string): number | null {
  return IMAGE_USD[model] ?? null;
}

export async function recordAiUsage(
  input: { area: string; model: string; promptTokens: number; completionTokens: number; usd: number | null },
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) return;
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query(
      `INSERT INTO ai_usage (area, model, prompt_tokens, completion_tokens, usd) VALUES ($1,$2,$3,$4,$5)`,
      [input.area, input.model, input.promptTokens, input.completionTokens, input.usd],
    );
  } catch {
    return;
  } finally {
    try {
      await client.end();
    } catch {
      return;
    }
  }
}

export type AiSpend = {
  todayUsd: number;
  totalUsd: number;
  promptTokens: number;
  completionTokens: number;
  todayPromptTokens: number;
  todayCompletionTokens: number;
  unpriced: number;
  recent: Array<{
    at: string;
    area: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    usd: number | null;
  }>;
};

export async function readAiSpend(databaseUrl = process.env.DATABASE_URL): Promise<AiSpend | null> {
  if (!databaseUrl) return null;
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const totals = await client.query<{
      today_usd: string | null;
      total_usd: string | null;
      prompt_tokens: string;
      completion_tokens: string;
      today_prompt_tokens: string;
      today_completion_tokens: string;
      unpriced: string;
    }>(`
      SELECT
        COALESCE(SUM(usd) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'America/Mexico_City'), 0)::text AS today_usd,
        COALESCE(SUM(usd), 0)::text AS total_usd,
        COALESCE(SUM(prompt_tokens), 0)::text AS prompt_tokens,
        COALESCE(SUM(completion_tokens), 0)::text AS completion_tokens,
        COALESCE(SUM(prompt_tokens) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'America/Mexico_City'), 0)::text AS today_prompt_tokens,
        COALESCE(SUM(completion_tokens) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'America/Mexico_City'), 0)::text AS today_completion_tokens,
        COUNT(*) FILTER (WHERE usd IS NULL)::text AS unpriced
      FROM ai_usage
    `);
    const recent = await client.query<{
      created_at: Date;
      area: string;
      model: string;
      prompt_tokens: number;
      completion_tokens: number;
      usd: string | null;
    }>(`
      SELECT created_at, area, model, prompt_tokens, completion_tokens, usd::text
      FROM ai_usage
      ORDER BY created_at DESC
      LIMIT 12
    `);
    const row = totals.rows[0];
    return {
      todayUsd: Number(row?.today_usd ?? 0),
      totalUsd: Number(row?.total_usd ?? 0),
      promptTokens: Number(row?.prompt_tokens ?? 0),
      completionTokens: Number(row?.completion_tokens ?? 0),
      todayPromptTokens: Number(row?.today_prompt_tokens ?? 0),
      todayCompletionTokens: Number(row?.today_completion_tokens ?? 0),
      unpriced: Number(row?.unpriced ?? 0),
      recent: recent.rows.map((item) => ({
        at: item.created_at.toISOString(),
        area: item.area,
        model: item.model,
        promptTokens: item.prompt_tokens,
        completionTokens: item.completion_tokens,
        usd: item.usd == null ? null : Number(item.usd),
      })),
    };
  } catch {
    return null;
  } finally {
    await client.end();
  }
}
