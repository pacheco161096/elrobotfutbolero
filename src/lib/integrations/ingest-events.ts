import pg from "pg";
import { readCredentials } from "@/lib/config/pending";
import { getOverrides, refreshOverrides } from "@/lib/control/overrides";
import type { IncomingEvent } from "@/lib/domain/types";
import { runPipeline } from "@/lib/engines/pipeline";
import { shouldFetchEvents } from "@/lib/cron/assess";
import { matchImageQuery } from "@/lib/engines/image-route";
import { presentCard } from "@/lib/engines/visual";
import { applyVoice } from "@/lib/integrations/openai-voice";
import { searchMatchImage } from "@/lib/integrations/web-image";
import { goalKey, reconcileGoals, type StoredGoal, type TrackedGoal } from "@/lib/engines/goal-reconcile";
import { API_FOOTBALL_HOST, mapLiveEvent, type LiveEventInput } from "@/lib/integrations/api-football";

function playerIdOf(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const id = (payload as { player?: { id?: unknown } }).player?.id;
  return typeof id === "number" ? id : null;
}

function isGoalItem(item: LiveEventInput): boolean {
  const type = (item.type ?? "").toLowerCase();
  const detail = (item.detail ?? "").toLowerCase();
  return type === "goal" && !detail.includes("missed penalty");
}

function readGoal(item: LiveEventInput): TrackedGoal | null {
  const playerId = item.player?.id;
  if (playerId == null) return null;
  return {
    playerId,
    minute: item.time?.elapsed ?? null,
    extra: item.time?.extra ?? null,
    player: item.player?.name ?? null,
    team: item.team?.name ?? null,
    detail: item.detail ?? null,
  };
}

export async function ingestPlayedEvents(env: Record<string, string | undefined> = process.env, now = new Date()): Promise<{ checked: number; stored: number }> {
  const key = env.API_FOOTBALL_KEY;
  const databaseUrl = env.DATABASE_URL;
  if (!key || !databaseUrl) return { checked: 0, stored: 0 };
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  await refreshOverrides(databaseUrl);
  let checked = 0;
  let stored = 0;
  try {
    const matches = await client.query<{
      fixture_id: string;
      home_team: string;
      away_team: string;
      home_score: number | null;
      away_score: number | null;
      status: string;
      kickoff_at: Date | null;
      event_count: string;
    }>(`SELECT m.fixture_id, m.home_team, m.away_team, m.home_score, m.away_score, m.status, m.kickoff_at,
              (SELECT count(*) FROM match_events e WHERE e.fixture_id = m.fixture_id) AS event_count
       FROM matches m`);
    for (const match of matches.rows) {
      if (!shouldFetchEvents({
        status: match.status,
        kickoffAt: match.kickoff_at ? match.kickoff_at.toISOString() : null,
        eventCount: Number(match.event_count),
        now,
      })) continue;
      checked += 1;
      const response = await fetch(`https://${env.API_FOOTBALL_HOST || API_FOOTBALL_HOST}/fixtures/events?fixture=${match.fixture_id}`, {
        headers: { "x-apisports-key": key },
      });
      const body = (await response.json()) as { response?: LiveEventInput[] };
      const items = (body.response ?? []).map((item) => ({ ...item, fixtureId: match.fixture_id, homeTeam: match.home_team, awayTeam: match.away_team, homeScore: match.home_score, awayScore: match.away_score }));
      const namedGoals = items.flatMap((item) => {
        if (!isGoalItem(item)) return [];
        const goal = readGoal(item);
        return goal ? [{ goal, item }] : [];
      });
      const storedGoals = await client.query<{ id: string; minute: number | null; player: string | null; team: string | null; payload: unknown }>(
        `SELECT id, minute, player, team, payload FROM match_events WHERE fixture_id = $1 AND event_type = 'GOAL'`,
        [match.fixture_id],
      );
      const knownGoals: StoredGoal[] = storedGoals.rows.flatMap((row) => {
        const playerId = playerIdOf(row.payload);
        if (playerId == null) return [];
        const extra = row.payload && typeof row.payload === "object" ? (row.payload as { time?: { extra?: number | null } }).time?.extra ?? null : null;
        return [{ id: row.id, playerId, minute: row.minute, extra, player: row.player, team: row.team, detail: null }];
      });
      const incomingByPlayer = new Map<number, TrackedGoal[]>();
      for (const entry of namedGoals) {
        const list = incomingByPlayer.get(entry.goal.playerId) ?? [];
        list.push(entry.goal);
        incomingByPlayer.set(entry.goal.playerId, list);
      }
      const plan = reconcileGoals(knownGoals, namedGoals.map((entry) => entry.goal));
      for (const change of plan.update) {
        const source = namedGoals.find((entry) => entry.goal === change.goal);
        if (!source) continue;
        await client.query(
          `UPDATE match_events SET minute = $2, player = $3, team = $4, payload = $5::jsonb WHERE id = $1`,
          [change.id, change.goal.minute, change.goal.player, change.goal.team, JSON.stringify(source.item)],
        );
      }
      const freshGoals = plan.insert.flatMap((goal) => {
        const list = incomingByPlayer.get(goal.playerId) ?? [];
        const ordered = [...list].sort((left, right) => (left.minute ?? 0) * 100 + (left.extra ?? 0) - ((right.minute ?? 0) * 100 + (right.extra ?? 0)));
        const source = namedGoals.find((entry) => entry.goal === goal);
        if (!source) return [];
        return [{ goal, index: ordered.indexOf(goal), item: source.item }];
      });
      const queue: Array<{ item: LiveEventInput; mapped: NonNullable<ReturnType<typeof mapLiveEvent>> }> = [];
      for (const item of items) {
        if (isGoalItem(item)) continue;
        const mapped = mapLiveEvent(item);
        if (mapped) queue.push({ item, mapped });
      }
      for (const fresh of freshGoals) {
        queue.push({
          item: fresh.item,
          mapped: {
            eventType: "GOAL",
            minute: fresh.goal.minute,
            player: fresh.goal.player,
            team: fresh.goal.team,
            detail: fresh.goal.detail,
            idempotencyKey: goalKey(match.fixture_id, fresh.goal, fresh.index),
          },
        });
      }
      for (const { item, mapped } of queue) {
        const inserted = await client.query(
          `INSERT INTO match_events (fixture_id, idempotency_key, event_type, minute, player, team, home_score, away_score, payload)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
           ON CONFLICT (idempotency_key) DO NOTHING
           RETURNING id`,
          [match.fixture_id, mapped.idempotencyKey, mapped.eventType, mapped.minute, mapped.player, mapped.team, match.home_score, match.away_score, JSON.stringify(item)],
        );
        if (!inserted.rowCount) continue;
        stored += 1;
        const incoming: IncomingEvent = {
          fixtureId: match.fixture_id,
          apiEventId: mapped.idempotencyKey,
          eventType: mapped.eventType as IncomingEvent["eventType"],
          minute: mapped.minute ?? undefined,
          player: mapped.player ?? undefined,
          team: mapped.team ?? undefined,
          detail: mapped.detail ?? undefined,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          homeScore: match.home_score,
          awayScore: match.away_score,
          origin: "api_event",
          sources: [{ kind: "api", stance: "apoya", name: "API-Football" }],
          existingStories: [],
          recentPosts: [],
        };
        const result = runPipeline(incoming, { credentials: readCredentials(env), overrides: getOverrides(), now: new Date() });
        const recent = result.draft
          ? await client.query<{ body: string }>(
              `SELECT body FROM posts WHERE body IS NOT NULL AND kind IN ('FLASH', 'KICKOFF', 'HALFTIME', 'PULSE') ORDER BY created_at DESC LIMIT 8`,
            )
          : { rows: [] as Array<{ body: string }> };
        const draft = result.draft
          ? await applyVoice({ ...result.draft, avoid: recent.rows.map((row) => row.body) }, env)
          : null;
        const story = await client.query(
          `INSERT INTO stories (story_key, fixture_id, title, status, last_event_type, home_score, away_score, claim_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (story_key) DO UPDATE SET last_event_type = EXCLUDED.last_event_type, updated_at = now()
           RETURNING id`,
          [result.story.key, match.fixture_id, `${mapped.eventType} · ${match.home_team} vs ${match.away_team}`, result.decision, mapped.eventType, match.home_score, match.away_score, result.claimStatus],
        );
        await client.query(
          `INSERT INTO editorial_decisions (story_id, event_id, decision, reason, importance, confidence, source_count, contradiction_status, cooldown_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [story.rows[0].id, inserted.rows[0].id, result.decision, result.reason, result.importance, result.truth, incoming.sources.length, result.truth, result.cooldown],
        );
        const spoken = draft && draft.voice === "openai" && draft.personality ? draft.text : draft?.locked.join("\n") ?? "";
        if (draft && spoken.trim()) {
          const kind = result.decision === "PUBLISH_NOW" ? "FLASH" : "CONTEXT";
          const needsMatchPhoto = kind !== "FLASH" && mapped.eventType !== "HALFTIME";
          const imageUrl = needsMatchPhoto && !getOverrides().pauseImages
            ? await searchMatchImage({
                query: matchImageQuery({ home: match.home_team, away: match.away_team, eventType: mapped.eventType }),
                teams: [match.home_team, match.away_team, mapped.player ?? ""].filter(Boolean),
                homeScore: match.home_score,
                awayScore: match.away_score,
              })
            : null;
          if (needsMatchPhoto && !imageUrl) continue;
          await client.query(
            `INSERT INTO posts (story_id, event_id, kind, idempotency_key, body, facts, tone, image_mode, status, club, format)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)
             ON CONFLICT (idempotency_key) DO NOTHING`,
            [
              story.rows[0].id,
              inserted.rows[0].id,
              kind,
              result.idempotencyKey,
              presentCard(spoken.split("\n")),
              JSON.stringify({ ...(result.flash?.facts ?? {}), imageUrl }),
              result.tone,
              imageUrl ? "fotografia_real" : "texto",
              result.publication.status,
              mapped.team,
              "texto",
            ],
          );
        }
      }
    }
  } finally {
    await client.end();
  }
  return { checked, stored };
}
