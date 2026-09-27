import { emptyOverrides, type Overrides } from "@/lib/control/overrides";
import type { IncomingEvent } from "@/lib/domain/types";
import { runPipeline, type PipelineResult } from "@/lib/engines/pipeline";
import { storyKeyFor } from "@/lib/engines/story";

const credentials = {
  database: false,
  apiFootball: false,
  openai: false,
  zernio: false,
  brightData: false,
  cron: false,
};

const now = new Date("2026-09-25T22:00:00.000Z");

function run(event: IncomingEvent, overrides: Overrides = emptyOverrides()): PipelineResult {
  return runPipeline(event, { credentials, overrides, now });
}

const goal: IncomingEvent = {
  fixtureId: "mx-100",
  apiEventId: "gol-queretaro-23",
  eventType: "GOAL",
  minute: 23,
  player: "Delantero",
  team: "Querétaro",
  homeTeam: "Querétaro",
  awayTeam: "Guadalajara",
  homeScore: 1,
  awayScore: 0,
  origin: "api_event",
  sources: [{ kind: "api", stance: "apoya", name: "API-Football" }],
  existingStories: [],
  recentPosts: [],
};

export function sampleRuns(): Array<{ title: string; result: PipelineResult }> {
  const penaltyKey = storyKeyFor(
    { fixtureId: "mx-200", eventType: "PENALTY", minute: 70, team: "América", player: undefined },
    [],
  );
  return [
    { title: "Gol confirmado", result: run(goal) },
    {
      title: "Gol sin marcador",
      result: run({ ...goal, apiEventId: "gol-sin-marcador", homeScore: null, awayScore: null }),
    },
    {
      title: "Suspensión con versiones distintas",
      result: run({
        fixtureId: "mx-300",
        apiEventId: "susp-300",
        eventType: "SUSPENDED",
        homeTeam: "Puebla",
        awayTeam: "Pumas",
        homeScore: 0,
        awayScore: 0,
        origin: "api_event",
        sources: [{ kind: "api", stance: "apoya", name: "API-Football" }],
        cause: {
          sources: [
            { kind: "medio", stance: "apoya", name: "Medio A" },
            { kind: "medio", stance: "contradice", name: "Medio B" },
            { kind: "local", stance: "contradice", name: "Sitio local" },
          ],
        },
        existingStories: [],
        recentPosts: [],
      }),
    },
    {
      title: "Reclamo justo después del penal",
      result: run({
        fixtureId: "mx-200",
        apiEventId: "reclamo-200",
        eventType: "COMPLAINT",
        minute: 72,
        team: "América",
        homeTeam: "América",
        awayTeam: "Cruz Azul",
        homeScore: 0,
        awayScore: 0,
        origin: "api_event",
        sources: [{ kind: "api", stance: "apoya", name: "API-Football" }],
        existingStories: [{ key: penaltyKey, lastEventType: "PENALTY", homeScore: 0, awayScore: 0 }],
        recentPosts: [{ fixtureId: "mx-200", storyKey: penaltyKey, importance: "MUY_ALTO", createdAt: "2026-09-25T21:58:00.000Z" }],
      }),
    },
    {
      title: "Tarjeta amarilla",
      result: run({
        fixtureId: "mx-400",
        apiEventId: "amarilla-400",
        eventType: "YELLOW_CARD",
        minute: 12,
        player: "Defensa",
        team: "Puebla",
        homeTeam: "Puebla",
        awayTeam: "Pumas",
        homeScore: 0,
        awayScore: 0,
        origin: "api_event",
        sources: [{ kind: "api", stance: "apoya", name: "API-Football" }],
        existingStories: [],
        recentPosts: [],
      }),
    },
  ];
}
