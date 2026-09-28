import pg from "pg";
import { pollingIntervalMs, type MatchStatus } from "@/lib/engines/match-state";
import { fetchLiveFixtures } from "@/lib/integrations/api-football";
import { ingestPlayedEvents } from "@/lib/integrations/ingest-events";
import { publishReadyPosts, runKickoffPosts } from "@/lib/integrations/publish";
import { saveMatches } from "@/lib/integrations/sync-matches";

const IDLE_MS = 60_000;

export function pollPlan(
  matches: Array<{ status: string; lastPolledAt: string | null }>,
  now: Date,
): { callApi: boolean; nextMs: number } {
  const active = matches.flatMap((match) => {
    const interval = pollingIntervalMs(match.status as MatchStatus);
    return interval == null ? [] : [{ interval, lastPolledAt: match.lastPolledAt }];
  });
  if (!active.length) return { callApi: false, nextMs: IDLE_MS };
  const callApi = active.some((match) => {
    if (!match.lastPolledAt) return true;
    return now.getTime() - new Date(match.lastPolledAt).getTime() >= match.interval;
  });
  return { callApi, nextMs: Math.min(...active.map((match) => match.interval)) };
}

async function withClient<T>(databaseUrl: string, run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

export async function pollLive(
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
): Promise<{ callApi: boolean; saved: number; checked: number; stored: number; nextMs: number; error: string | null }> {
  const databaseUrl = env.DATABASE_URL;
  const key = env.API_FOOTBALL_KEY;
  if (!databaseUrl || !key) {
    return { callApi: false, saved: 0, checked: 0, stored: 0, nextMs: IDLE_MS, error: "Faltan DATABASE_URL o API_FOOTBALL_KEY." };
  }
  const rows = await withClient(databaseUrl, async (client) => {
    const result = await client.query<{ status: string; last_polled_at: Date | null }>(
      `SELECT status, last_polled_at FROM matches`,
    );
    return result.rows.map((row) => ({
      status: row.status,
      lastPolledAt: row.last_polled_at ? row.last_polled_at.toISOString() : null,
    }));
  });
  const plan = pollPlan(rows, now);
  let saved = 0;
  let checked = 0;
  let stored = 0;
  let error: string | null = null;
  if (plan.callApi) {
    const live = await fetchLiveFixtures({ key, host: env.API_FOOTBALL_HOST });
    error = live.error;
    if (!live.error) {
      saved = await saveMatches(databaseUrl, live.matches);
      const events = await ingestPlayedEvents(env, now);
      checked = events.checked;
      stored = events.stored;
      try {
        await runKickoffPosts(env);
        await publishReadyPosts(env);
      } catch {
        error = error ?? "No pude publicar lo que ya estaba listo.";
      }
    }
  }
  await withClient(databaseUrl, (client) =>
    client.query(`INSERT INTO system_logs (level, area, message, context) VALUES ($1,'live-worker',$2,$3::jsonb)`, [
      error ? "error" : "info",
      error ?? (plan.callApi ? "Sondeo en vivo." : "Nada en juego. No consulté API-Football."),
      JSON.stringify({ callApi: plan.callApi, saved, checked, stored }),
    ]),
  );
  return { callApi: plan.callApi, saved, checked, stored, nextMs: plan.nextMs, error };
}
