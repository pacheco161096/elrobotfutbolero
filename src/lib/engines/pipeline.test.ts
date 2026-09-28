import { emptyOverrides } from "@/lib/control/overrides";
import type { IncomingEvent } from "@/lib/domain/types";
import { secondContextPost } from "@/lib/engines/context";
import { enqueueJob, nextJob } from "@/lib/engines/jobs";
import { pollingIntervalMs, transition, watchdogFindings } from "@/lib/engines/match-state";
import { expressionFile, pickExpression } from "@/lib/engines/copy";
import { runPipeline } from "@/lib/engines/pipeline";
import { storyKeyFor } from "@/lib/engines/story";
import { classifyTruth } from "@/lib/engines/truth";
import { coveredLiveFixturesUrl, fetchFixtures, fetchLiveFixtures, liveFixturesUrl, mapFixture, mapLiveEvent } from "@/lib/integrations/api-football";
import { presentMatch } from "@/lib/matches/present";
import { FACEBOOK_BLACK_TEXT_PRESET, publishWithZernio, zernioPostBody } from "@/lib/integrations/gates";
import { liveWorkerTick } from "@/lib/worker/tick";
import { describe, expect, it, vi } from "vitest";

const credentialsOff = {
  database: false,
  apiFootball: false,
  openai: false,
  zernio: false,
  brightData: false,
  cron: false,
};

const now = new Date("2026-09-25T22:00:00.000Z");

function base(overrides: Partial<IncomingEvent> = {}): IncomingEvent {
  return {
    fixtureId: "fx",
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
    ...overrides,
  };
}

describe("pipeline", () => {
  it("no publica un gol confirmado mientras faltan credenciales", () => {
    const result = runPipeline(base({ apiEventId: "gol-1" }), { credentials: credentialsOff, overrides: emptyOverrides(), now });
    expect(result.decision).toBe("PUBLISH_NOW");
    expect(result.idempotencyKey).toBe("api:gol-1");
    expect(result.flash?.lockedLines[0]).toContain("QUERÉTARO");
    expect(result.flash?.facts.home_score).toBe(1);
    expect(result.publication.status).toBe("pending_credentials");
    expect(result.jobs[0]).toMatchObject({ type: "FLASH", priority: 100 });
    expect(result.draft?.locked.join("\n")).toContain("Querétaro 1-0 Guadalajara.");
    expect(result.draft?.personality).not.toMatch(/\d+\s*-\s*\d+/);
    expect(result.draft?.text.startsWith(result.draft.locked.join("\n"))).toBe(true);
  });

  it("no inventa el marcador", () => {
    const result = runPipeline(base({ homeScore: null, awayScore: null }), { credentials: credentialsOff, overrides: emptyOverrides(), now });
    expect(result.decision).toBe("WAIT");
    expect(result.publication.status).toBe("not_requested");
    expect(result.flash?.valid).toBe(false);
  });

  it("descarta la amarilla", () => {
    const result = runPipeline(base({ eventType: "YELLOW_CARD" }), { credentials: credentialsOff, overrides: emptyOverrides(), now });
    expect(result.importance).toBe("BAJO");
    expect(result.decision).toBe("DISCARD");
  });

  it("no afirma la causa si las fuentes se contradicen", () => {
    const result = runPipeline(base({
      eventType: "SUSPENDED",
      cause: {
        sources: [
          { kind: "medio", stance: "apoya", name: "A" },
          { kind: "medio", stance: "contradice", name: "B" },
        ],
      },
    }), { credentials: credentialsOff, overrides: emptyOverrides(), now });
    expect(result.flash?.causeMode).toBe("contradicted");
    expect(result.flash?.facts.cause).toBeUndefined();
    expect(result.flash?.lockedLines.join(" ")).toContain("versiones distintas");
  });

  it("no abre otra publicación por un reclamo repetido del mismo episodio", () => {
    const key = storyKeyFor({ fixtureId: "fx", eventType: "PENALTY", minute: 70, team: "América" }, []);
    const result = runPipeline(base({
      eventType: "COMPLAINT",
      minute: 72,
      team: "América",
      homeTeam: "América",
      awayTeam: "Cruz Azul",
      homeScore: 0,
      awayScore: 0,
      existingStories: [{ key, lastEventType: "PENALTY", homeScore: 0, awayScore: 0 }],
      recentPosts: [{ fixtureId: "fx", storyKey: key, importance: "MUY_ALTO", createdAt: "2026-09-25T21:58:00.000Z" }],
    }), { credentials: credentialsOff, overrides: emptyOverrides(), now });
    expect(result.story.action).toBe("update");
    expect(result.decision).toBe("UPDATE_EXISTING_STORY");
    expect(result.publication.status).toBe("not_requested");
  });

  it("no cambia el dato cuando el equipo es América", () => {
    const result = runPipeline(base({
      team: "América",
      homeTeam: "América",
      awayTeam: "Pumas",
      homeScore: 1,
      awayScore: 0,
    }), { credentials: credentialsOff, overrides: emptyOverrides(), now });
    expect(result.americaTag).toBe(true);
    expect(result.flash?.facts.home_score).toBe(1);
    expect(result.flash?.facts.away_score).toBe(0);
    expect(result.draft?.locked.join(" ")).toContain("América 1-0 Pumas.");
    expect(result.draft?.personality).toBe("Otra vez el América. Qué raro. 🤖");
  });

  it("baja el humor si el tema es sensible", () => {
    const result = runPipeline(base({ eventType: "INCIDENT", topics: ["accidente grave"] }), {
      credentials: credentialsOff,
      overrides: emptyOverrides(),
      now,
    });
    expect(result.tone).toBe("informar_sin_humor");
  });

  it("una fanpage sola no es un hecho", () => {
    expect(classifyTruth({
      origin: "claim",
      sources: [{ kind: "fanpage", stance: "apoya", name: "Fans" }],
    })).toBe("AFIRMACION_DE_UNA_FUENTE");
  });
});

describe("partido", () => {
  it("baja el sondeo en suspensión y no cierra el partido por el paso del tiempo", () => {
    expect(pollingIntervalMs("LIVE")).toBe(15_000);
    expect(pollingIntervalMs("SUSPENDED")).toBe(90_000);
    const stale = transition("SUSPENDED", { type: "unchanged" }, 6 * 60 * 60_000);
    expect(stale.status).toBe("STALE");
    expect(stale.status).not.toBe("CLOSED");
  });

  it("al volver de suspensión pide evaluar la reanudación", () => {
    const next = transition("SUSPENDED", { type: "api", status: "LIVE" });
    expect(next.effects).toContain("evento_RESUMPTION");
    expect(pollingIntervalMs(next.status)).toBe(15_000);
  });

  it("el watchdog ve un partido vivo sin sondeo", () => {
    const findings = watchdogFindings({
      now,
      matches: [{ id: "m1", status: "LIVE", lastPolledAt: "2026-09-25T21:00:00.000Z" }],
      jobs: [{ id: "j1", status: "failed" }],
      workerLastSeenAt: "2026-09-25T21:00:00.000Z",
    });
    expect(findings.map((item) => item.code)).toEqual(["match_stuck", "job_failed", "worker_silent"]);
  });
});

describe("redacción y cola", () => {
  it("un tema sensible conserva el dato y quita el chiste", () => {
    const result = runPipeline(base({ topics: ["accidente grave"] }), {
      credentials: credentialsOff,
      overrides: emptyOverrides(),
      now,
    });
    expect(result.tone).toBe("informar_sin_humor");
    expect(result.draft?.locked.join("\n")).toContain("Querétaro 1-0 Guadalajara.");
    expect(result.draft?.personality).toBeNull();
  });

  it("no abre un segundo post si el contexto repite lo mismo", () => {
    expect(secondContextPost({
      known: ["El partido se suspendió"],
      incoming: ["el partido se suspendio"],
    }).decision).toBe("DISCARD");
  });

  it("actualiza la historia si el contexto trae un dato nuevo", () => {
    expect(secondContextPost({
      known: ["El partido se suspendió"],
      incoming: ["La liga confirmó lluvia"],
    }).decision).toBe("UPDATE_EXISTING_STORY");
  });

  it("un reintento no duplica el job y el flash sale antes que el contexto", () => {
    const first = enqueueJob([], { idempotencyKey: "flash:gol-1", type: "FLASH", priority: 100 });
    const again = enqueueJob(first.queue, { idempotencyKey: "flash:gol-1", type: "FLASH", priority: 100 });
    const withContext = enqueueJob(again.queue, { idempotencyKey: "context:gol-1", type: "CONTEXT", priority: 50 });
    expect(again.created).toBe(false);
    expect(withContext.queue).toHaveLength(2);
    expect(nextJob(withContext.queue)?.type).toBe("FLASH");
  });
});

describe("api football", () => {
  it("guarda el marcador que viene en el partido y no inventa otro", () => {
    const match = mapFixture({
      fixture: { id: 10, date: "2026-09-25T01:00:00.000Z", status: { short: "FT", elapsed: 90 } },
      league: { name: "Liga MX" },
      teams: { home: { name: "Puebla" }, away: { name: "Pumas" } },
      goals: { home: 0, away: 0 },
    }, now);
    expect(match?.homeScore).toBe(0);
    expect(match?.awayScore).toBe(0);
    expect(match?.status).toBe("FT");
  });

  it("un partido programado no muestra marcador", () => {
    const view = presentMatch({
      fixtureId: "1",
      homeTeam: "Puebla",
      awayTeam: "Pumas",
      homeScore: null,
      awayScore: null,
      status: "SCHEDULED",
      kickoffAt: "2026-09-26T01:00:00.000Z",
      minute: null,
      round: "Apertura - 10",
      league: null,
    });
    expect(view.scored).toBe(false);
    expect(view.center).not.toMatch(/\d+-\d+/);
    expect(view.detail).toBe("Programado");
  });

  it("el VAR sin fallo no inventa la decisión", () => {
    const result = runPipeline(base({ eventType: "VAR", player: "Delantero", team: "León", detail: "Goal Under Review", homeScore: null, awayScore: null }), {
      credentials: credentialsOff,
      overrides: emptyOverrides(),
      now,
    });
    expect(result.flash?.valid).toBe(true);
    expect(result.flash?.lockedLines.join(" ")).toContain("revisa una jugada");
    expect(result.flash?.lockedLines.join(" ")).not.toContain("Delantero");
    expect(result.flash?.lockedLines.join(" ")).not.toMatch(/\d+\s*[-–]\s*\d+/);
    expect(result.visual.mode).toBe("texto");
  });

  it("una palabra bloqueada no se publica", () => {
    const result = runPipeline(base({ text: "se fue la luz" }), {
      credentials: credentialsOff,
      overrides: { ...emptyOverrides(), blockedWords: ["luz"] },
      now,
    });
    expect(result.decision).toBe("DISCARD");
    expect(result.reason).toContain("luz");
  });

  it("un gol sin detalle de penal fallado sigue siendo gol", () => {
    expect(mapLiveEvent({
      fixtureId: "1",
      homeTeam: "León",
      awayTeam: "Juárez",
      homeScore: 1,
      awayScore: 0,
      type: "Goal",
      detail: "Normal Goal",
      time: { elapsed: 23 },
      team: { name: "León" },
      player: { name: "Delantero" },
    })?.eventType).toBe("GOAL");
  });

  it("pide los partidos con la llave en el header", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ response: [] })));
    await fetchFixtures({ from: "2026-09-24", to: "2026-09-28", season: 2026, key: "llave-de-prueba" }, fetchImpl);
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(call[0])).toContain("league=262");
    expect(call[1].headers).toMatchObject({ "x-apisports-key": "llave-de-prueba" });
  });

  it("el vivo pide la liga con live=all y descarta otras ligas", async () => {
    expect(liveFixturesUrl(262, "v3.football.api-sports.io", 2026)).toBe(
      "https://v3.football.api-sports.io/fixtures?league=262&season=2026&live=all",
    );
    expect(coveredLiveFixturesUrl()).toBe("https://v3.football.api-sports.io/fixtures?live=all");
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      response: [
        {
          fixture: { id: 1, status: { short: "1H" } },
          league: { id: 39, name: "Premier League" },
          teams: { home: { name: "A" }, away: { name: "B" } },
          goals: { home: 1, away: 0 },
        },
        {
          fixture: { id: 2, status: { short: "1H" } },
          league: { id: 262, name: "Liga MX" },
          teams: { home: { name: "León" }, away: { name: "Juárez" } },
          goals: { home: 0, away: 0 },
        },
        {
          fixture: { id: 3, status: { short: "1H" } },
          league: { id: 5, name: "UEFA Nations League" },
          teams: { home: { name: "Belgium" }, away: { name: "France" } },
          goals: { home: 0, away: 0 },
        },
      ],
    })));
    const live = await fetchLiveFixtures({ key: "llave" }, fetchImpl);
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(call[0])).toBe("https://v3.football.api-sports.io/fixtures?live=all");
    expect(live.error).toBeNull();
    expect(live.matches.map((match) => match.fixtureId)).toEqual(["2", "3"]);
  });
});

describe("expresiones", () => {
  it("un gol usa la cara de golazo", () => {
    expect(pickExpression({ eventType: "GOAL", tone: "normal" })).toBe("golazo");
    expect(expressionFile("golazo")).toBe("docs/expresiones/expresion-golazo.png");
  });

  it("una expresión desconocida no inventa un archivo", () => {
    expect(expressionFile("fiesta")).toBeNull();
  });
});

describe("integraciones pendientes", () => {
  it("Zernio no hace ninguna llamada sin la llave y la página", async () => {
    const fetchImpl = vi.fn();
    const result = await publishWithZernio({ idempotencyKey: "x", text: "hola" }, {}, fetchImpl);
    expect(result.status).toBe("pending_credentials");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("el Flash sale como texto con fondo negro y el segundo post puede llevar imagen", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ post: { _id: "z1" } }), { status: 200 }));
    const flash = zernioPostBody({ text: "⚽ GOOOOL DE LEÓN.", accountId: "acc_demo", textPresetId: FACEBOOK_BLACK_TEXT_PRESET });
    expect(flash.mediaItems).toBeUndefined();
    expect(flash.platforms[0].platformSpecificData).toEqual({ facebookSettings: { textFormatPresetId: FACEBOOK_BLACK_TEXT_PRESET } });
    const withPhoto = zernioPostBody({
      text: "El centro vino de la derecha.",
      accountId: "acc_demo",
      imageUrl: "https://cdn.example.com/gol.jpg",
      textPresetId: FACEBOOK_BLACK_TEXT_PRESET,
    });
    expect(withPhoto.mediaItems).toEqual([{ type: "image", url: "https://cdn.example.com/gol.jpg" }]);
    expect(withPhoto.platforms[0].platformSpecificData).toBeUndefined();
    const sent = await publishWithZernio({ idempotencyKey: "gol-1", text: "⚽ GOOOOL DE LEÓN." }, {
      ZERNIO_API_KEY: "llave",
      ZERNIO_ACCOUNT_ID: "acc_demo",
      ZERNIO_TEXT_PRESET_ID: "106018623298955",
    }, fetchImpl);
    expect(sent).toEqual({ status: "sent", externalId: "z1" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://zernio.com/api/v1/posts");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer llave");
    expect(JSON.parse(init.body as string)).toEqual(flash);
  });

  it("el worker no sondea sin base ni API-Football", async () => {
    const poll = vi.fn();
    const result = await liveWorkerTick({
      credentials: { database: false, apiFootball: false },
      overrides: emptyOverrides(),
      poll,
    });
    expect(result.status).toBe("pending_credentials");
    expect(poll).not.toHaveBeenCalled();
  });
});
