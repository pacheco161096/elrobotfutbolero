import pg from "pg";
import { getOverrides, refreshOverrides } from "@/lib/control/overrides";
import { mentionsMatch, reviewSocialHits } from "@/lib/engines/context";
import { sharedTopic } from "@/lib/engines/cron-budget";
import { backupImageQuery, backupLocked, backupSituation, squadNotes, type BackupEvent } from "@/lib/engines/backup-post";
import { matchImageQuery } from "@/lib/engines/image-route";
import { teamSpoken } from "@/lib/engines/team-names";
import { brightDataMissing, facebookPageUrls, pollSocialSearch, triggerSocialSearch } from "@/lib/integrations/bright-data";
import { applyVoice, reinterpretPage } from "@/lib/integrations/openai-voice";
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
  payload: { snapshotId?: string; phase?: string } | null;
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

type BackupRow = {
  fixture_id: string;
  event_type: string;
  minute: number | null;
  player: string | null;
  team: string | null;
  home_score: number | null;
  away_score: number | null;
  detail: string | null;
  home_team: string;
  away_team: string;
  goal_number: number | null;
};

function eventFromRow(storyKey: string, row: BackupRow): BackupEvent {
  return {
    eventType: row.event_type,
    minute: row.minute,
    player: row.player,
    team: row.team,
    detail: row.detail,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeScore: row.home_score,
    awayScore: row.away_score,
    goalNumber: row.event_type === "GOAL" && row.detail && !/own/i.test(row.detail) ? row.goal_number : null,
    storyKey,
  };
}

function pickBackupRow(storyKey: string, rows: BackupRow[]): BackupRow | null {
  const exact = rows.find((row) => {
    const minute = row.minute ?? "x";
    const team = row.team ?? "x";
    const player = row.player ?? "na";
    return storyKey === `fixture:${row.fixture_id}:gol:${minute}:${team}`
      || storyKey === `fixture:${row.fixture_id}:${row.event_type}:${minute}:${team}:${player}`;
  });
  if (exact) return exact;
  const loose = rows.find((row) => row.minute != null && row.team && storyKey.includes(`:${row.minute}:`) && storyKey.toLowerCase().includes(row.team.toLowerCase()));
  if (loose) return loose;
  if (storyKey.endsWith(":controversia") || storyKey.endsWith(":suspension")) return rows[0] ?? null;
  return null;
}

async function matchSquad(
  fixtureId: string,
  homeTeam: string,
  awayTeam: string,
  focusTeam: string | null,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<{ onBench: string[]; notCalled: string[] }> {
  const empty = { onBench: [], notCalled: [] };
  const key = env.API_FOOTBALL_KEY;
  if (!key) return empty;
  const host = env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
  try {
    const response = await fetchImpl(`https://${host}/fixtures/lineups?fixture=${encodeURIComponent(fixtureId)}`, {
      headers: { "x-apisports-key": key },
    });
    if (!response.ok) return empty;
    const body = await response.json() as {
      response?: Array<{
        team?: { name?: string };
        startXI?: Array<{ player?: { name?: string } }>;
        substitutes?: Array<{ player?: { name?: string } }>;
      }>;
    };
    const names = (rows?: Array<{ player?: { name?: string } }>) =>
      (rows ?? []).map((item) => item.player?.name).filter((name): name is string => Boolean(name));
    const sheets = body.response ?? [];
    const home = sheets.find((item) => item.team?.name === homeTeam) ?? sheets[0];
    const away = sheets.find((item) => item.team?.name === awayTeam) ?? sheets[1];
    if (!home || !away) return empty;
    return squadNotes({
      homeTeam,
      awayTeam,
      homeStarters: names(home.startXI),
      homeBench: names(home.substitutes),
      awayStarters: names(away.startXI),
      awayBench: names(away.substitutes),
      focusTeam,
    });
  } catch {
    return empty;
  }
}

async function queueBackup(
  client: pg.Client,
  candidate: Candidate,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<"queued" | "skip" | "retry"> {
  const rows = await client.query<BackupRow>(
    `SELECT e.fixture_id, e.event_type, e.minute, e.player, e.team, e.home_score, e.away_score,
            e.payload->>'detail' AS detail, m.home_team, m.away_team,
            (SELECT count(*)::int FROM match_events g
              WHERE g.fixture_id = e.fixture_id AND g.event_type = 'GOAL' AND g.team = e.team
                AND (g.minute < e.minute OR (g.minute = e.minute AND g.created_at <= e.created_at))) AS goal_number
     FROM stories s
     JOIN matches m ON m.fixture_id = s.fixture_id
     JOIN match_events e ON e.fixture_id = s.fixture_id AND e.event_type = s.last_event_type
     WHERE s.id = $1
     ORDER BY e.created_at DESC`,
    [candidate.story_id],
  );
  const row = pickBackupRow(candidate.story_key, rows.rows);
  if (!row) return "skip";
  const event = eventFromRow(candidate.story_key, row);
  const squad = await matchSquad(row.fixture_id, row.home_team, row.away_team, row.team, env, fetchImpl);
  event.onBench = squad.onBench;
  event.notCalled = squad.notCalled;
  const locked = backupLocked(event);
  const query = backupImageQuery(event);
  if (!locked || !query) return "skip";
  const recent = await client.query<{ body: string }>(
    `SELECT body FROM posts WHERE body IS NOT NULL ORDER BY created_at DESC LIMIT 8`,
  );
  const draft = await applyVoice({
    locked,
    personality: null,
    text: locked.join("\n"),
    voice: "plantilla",
    eventType: event.eventType,
    minute: event.minute,
    situation: backupSituation(locked),
    avoid: recent.rows.map((item) => item.body),
  }, env, fetchImpl);
  if (draft.voice !== "openai" || !draft.personality) return "retry";
  await refreshOverrides(env.DATABASE_URL ?? "");
  if (getOverrides().pauseImages) return "skip";
  const image = await searchMatchImage({
    query,
    teams: [event.player, event.homeTeam, event.awayTeam].filter((item): item is string => Boolean(item)),
    homeScore: event.homeScore,
    awayScore: event.awayScore,
  }, fetchImpl);
  if (!image) return "retry";
  await client.query(
    `INSERT INTO posts (story_id, kind, idempotency_key, body, facts, tone, image_mode, status, format)
     VALUES ($1, 'CONTEXT', $2, $3, $4::jsonb, 'normal', 'fotografia_real', 'queued', 'texto')
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [candidate.story_id, `context-post:${candidate.story_key}`, draft.text, JSON.stringify({ imageUrl: image })],
  );
  return "queued";
}

async function settleBackup(
  client: pg.Client,
  jobKey: string,
  outcome: "queued" | "skip" | "retry",
): Promise<SocialContextResult> {
  if (outcome === "retry") {
    await client.query(
      `UPDATE jobs SET status = 'running', payload = payload || '{"phase":"backup"}'::jsonb, updated_at = now() WHERE idempotency_key = $1`,
      [jobKey],
    );
    return { status: "pending", checked: 1 };
  }
  await client.query(`UPDATE jobs SET status = 'done', last_error = NULL, updated_at = now() WHERE idempotency_key = $1`, [jobKey]);
  return { status: "ready", checked: 1 };
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
    const jobKey = `bright:${candidate.story_key}`;
    if (candidate.payload?.phase === "backup") return settleBackup(client, jobKey, await queueBackup(client, candidate, env, fetchImpl));
    const missing = brightDataMissing(env);
    if (missing.length) return { status: "pending_credentials", checked: 1, missing };
    const pages = facebookPageUrls(env.BRIGHT_DATA_PAGE_URLS);
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
      await client.query(`UPDATE jobs SET last_error = $2, updated_at = now() WHERE idempotency_key = $1`, [jobKey, polled.message]);
      return settleBackup(client, jobKey, await queueBackup(client, candidate, env, fetchImpl));
    }
    const review = reviewSocialHits({ known: await knownClaims(client, candidate.story_id, candidate.title), hits: polled.hits });
    await saveReview(client, candidate.story_id, review);
    const teams = [candidate.home_team, candidate.away_team];
    const consensus = sharedTopic(polled.hits.filter((hit) => mentionsMatch(hit.text, teams)));
    const related = review.claims.filter((claim) => mentionsMatch(claim.text, teams));
    const pick = related[0];
    let posted = false;
    if (pick) {
      const line = await reinterpretPage({
        source: pick.text,
        author: pick.author,
        situation: `Reacción a lo que se dice de ${teamSpoken(candidate.home_team, `${candidate.story_key}:home`)} contra ${teamSpoken(candidate.away_team, `${candidate.story_key}:away`)}. El dato del marcador ya salió aparte. Nómbralos así, en español. Aquí solo cabe un ángulo propio.`,
      }, env, fetchImpl);
      if (line) {
        await refreshOverrides(databaseUrl);
        const image = getOverrides().pauseImages
          ? null
          : await searchMatchImage({
              query: matchImageQuery({ home: candidate.home_team, away: candidate.away_team, eventType: candidate.last_event_type }),
              teams: [candidate.home_team, candidate.away_team],
              avoid: pick.imageUrl,
            }, fetchImpl);
        if (image) await client.query(
          `INSERT INTO posts (story_id, kind, idempotency_key, body, facts, tone, image_mode, status, format)
           VALUES ($1, 'CONTEXT', $2, $3, $4::jsonb, 'normal', $5, 'queued', 'texto')
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [
            candidate.story_id,
            `context-post:${candidate.story_key}`,
            line,
            JSON.stringify({ imageUrl: image, consensus }),
            "fotografia_real",
          ],
        );
        if (image) posted = true;
      }
    }
    if (!posted) return settleBackup(client, jobKey, await queueBackup(client, candidate, env, fetchImpl));
    await client.query(`UPDATE jobs SET status = 'done', last_error = NULL, updated_at = now() WHERE idempotency_key = $1`, [jobKey]);
    return { status: "ready", checked: 1, decision: review.decision };
  } finally {
    await client.end();
  }
}
