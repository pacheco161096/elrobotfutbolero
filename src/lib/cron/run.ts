import pg from "pg";
import { assessSchedule, inconsistentFindings, type ScheduledFixture } from "@/lib/cron/assess";
import { watchdogFindings, type MatchStatus, type WatchdogFinding } from "@/lib/engines/match-state";
import { ingestPlayedEvents } from "@/lib/integrations/ingest-events";
import { syncLigaMx } from "@/lib/integrations/sync-matches";

type Env = Record<string, string | undefined>;

async function withClient<T>(databaseUrl: string, run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function writeLog(databaseUrl: string, level: string, area: string, message: string, context: unknown): Promise<void> {
  await withClient(databaseUrl, (client) =>
    client.query(`INSERT INTO system_logs (level, area, message, context) VALUES ($1,$2,$3,$4::jsonb)`, [
      level,
      area,
      message,
      JSON.stringify(context ?? {}),
    ]),
  );
}

async function loadSchedule(databaseUrl: string): Promise<ScheduledFixture[]> {
  return withClient(databaseUrl, async (client) => {
    const result = await client.query<{ fixture_id: string; status: string; kickoff_at: Date | null }>(
      `SELECT fixture_id, status, kickoff_at FROM matches`,
    );
    return result.rows.map((row) => ({
      fixtureId: row.fixture_id,
      status: row.status,
      kickoffAt: row.kickoff_at ? row.kickoff_at.toISOString() : null,
    }));
  });
}

export async function runSyncMatches(env: Env = process.env, now = new Date()) {
  const result = await syncLigaMx(env, now);
  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl) {
    await writeLog(databaseUrl, result.error ? "error" : "info", "sync-matches", result.error ?? "Jornada sincronizada.", {
      saved: result.saved,
      window: result.window,
    });
  }
  return result;
}

export async function runFootballEngine(env: Env = process.env, now = new Date()) {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) return { preMatch: 0, refreshed: false, saved: 0, checked: 0, stored: 0, error: "Falta DATABASE_URL." };
  const schedule = await loadSchedule(databaseUrl);
  const assessment = assessSchedule(schedule, now);
  if (!assessment.refresh) {
    const updated = assessment.preMatch.length
      ? await withClient(databaseUrl, async (client) => {
          const result = await client.query(
            `UPDATE matches SET status = 'PRE_MATCH', updated_at = now() WHERE fixture_id = ANY($1::text[]) AND status = 'SCHEDULED'`,
            [assessment.preMatch],
          );
          return result.rowCount ?? 0;
        })
      : 0;
    await writeLog(databaseUrl, "info", "football-engine", "Nada en juego. No consulté API-Football.", { preMatch: updated });
    return { preMatch: updated, refreshed: false, saved: 0, checked: 0, stored: 0, error: null };
  }
  const synced = await syncLigaMx(env, now);
  if (synced.error) {
    await writeLog(databaseUrl, "error", "football-engine", synced.error, { window: synced.window });
    return { preMatch: 0, refreshed: false, saved: 0, checked: 0, stored: 0, error: synced.error };
  }
  const events = await ingestPlayedEvents(env);
  await writeLog(databaseUrl, "info", "football-engine", "Revisé los partidos que ya deberían haber empezado.", {
    saved: synced.saved,
    checked: events.checked,
    stored: events.stored,
  });
  return { preMatch: 0, refreshed: true, saved: synced.saved, checked: events.checked, stored: events.stored, error: null };
}

export async function runWatchdog(env: Env = process.env, now = new Date()): Promise<{ findings: WatchdogFinding[]; error: string | null }> {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) return { findings: [], error: "Falta DATABASE_URL." };
  const findings = await withClient(databaseUrl, async (client) => {
    const matches = await client.query<{ fixture_id: string; status: string; kickoff_at: Date | null; last_polled_at: Date | null }>(
      `SELECT fixture_id, status, kickoff_at, last_polled_at FROM matches`,
    );
    const jobs = await client.query<{ id: string; status: string }>(`SELECT id::text, status FROM jobs WHERE status = 'failed'`);
    const worker = await client.query<{ seen: Date | null }>(
      `SELECT max(created_at) AS seen FROM system_logs WHERE area = 'live-worker'`,
    );
    const pendingEvents = await client.query<{ id: string }>(
      `SELECT e.id::text
       FROM match_events e
       LEFT JOIN editorial_decisions d ON d.event_id = e.id
       WHERE d.id IS NULL`,
    );
    const schedule = matches.rows.map((row) => ({
      fixtureId: row.fixture_id,
      status: row.status,
      kickoffAt: row.kickoff_at ? row.kickoff_at.toISOString() : null,
    }));
    return [
      ...watchdogFindings({
        now,
        matches: matches.rows.map((row) => ({
          id: row.fixture_id,
          status: row.status as MatchStatus,
          lastPolledAt: row.last_polled_at ? row.last_polled_at.toISOString() : null,
        })),
        jobs: jobs.rows,
        workerLastSeenAt: worker.rows[0]?.seen ? worker.rows[0].seen.toISOString() : null,
      }),
      ...inconsistentFindings(schedule, now),
      ...pendingEvents.rows.map((row) => ({
        code: "event_unprocessed",
        message: "Evento sin decisión editorial.",
        ref: row.id,
      })),
    ];
  });
  await writeLog(
    databaseUrl,
    findings.length ? "warn" : "info",
    "watchdog",
    findings.length ? `${findings.length} hallazgos.` : "Sin hallazgos.",
    { findings },
  );
  return { findings, error: null };
}
