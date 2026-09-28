import { describe, expect, it, vi } from "vitest";
import { acceptVoiceLine, composeDraft, voiceFits } from "@/lib/engines/copy";
import { buildFlash } from "@/lib/engines/flash";
import { applyVoice } from "@/lib/integrations/openai-voice";

const draft = composeDraft({
  eventType: "GOAL",
  lockedLines: ["GOL DE QUERÉTARO.", "Minuto 12.", "Querétaro 1-0 Guadalajara."],
  tone: "normal",
  america: false,
});

describe("voz", () => {
  it("acepta una línea sin marcador", () => {
    const next = acceptVoiceLine(draft, "Apenas estaba calentando servidores. 🤖");
    expect(next.voice).toBe("openai");
    expect(next.locked.join("\n")).toBe(draft.locked.join("\n"));
    expect(next.text.startsWith(draft.locked.join("\n"))).toBe(true);
    expect(next.personality).not.toMatch(/\d+\s*-\s*\d+/);
  });

  it("si el modelo mete el marcador, esa frase no se publica", () => {
    const next = acceptVoiceLine(draft, "Qué golazo, ya van 1-0.");
    expect(next.voice).toBe("plantilla");
    expect(next.personality).toBeNull();
    expect(next.text).toBe(draft.locked.join("\n"));
  });

  it("un gol del segundo tiempo no dice que apenas llega", () => {
    const late = composeDraft({
      eventType: "GOAL",
      lockedLines: ["⚽ GOOOOL DE LEON.", "Leon 1-0 FC Juarez."],
      tone: "normal",
      america: false,
      minute: 79,
      seed: "1550982:GOAL:79",
    });
    expect(late.personality).not.toMatch(/calentando|apenas estaba/i);
    expect(late.situation).toContain("segundo tiempo");
    const ownGoal = composeDraft({
      eventType: "GOAL",
      lockedLines: ["Autogol de Francisco Nevarez.", "Leon 1-0 FC Juarez."],
      tone: "normal",
      america: false,
      minute: 76,
      detail: "Own Goal",
      seed: "1550982:own",
    });
    expect(ownGoal.situation).toContain("Autogol");
    expect(ownGoal.situation).toContain("segundo tiempo");
    expect(ownGoal.personality).not.toMatch(/calentando|golazo/i);
    const penalty = composeDraft({
      eventType: "GOAL",
      lockedLines: ["Penal de Oscar Estupiñan.", "Leon 1-1 FC Juarez."],
      tone: "normal",
      america: false,
      minute: 90,
      detail: "Penalty",
      seed: "1550982:pen",
    });
    expect(penalty.situation).toContain("penal");
    expect(penalty.situation).toContain("compensación");
    expect(penalty.personality).toMatch(/penal/i);
    expect(voiceFits("Y yo que apenas estaba calentando servidores. 🤖", 79)).toBe(false);
    const rejected = acceptVoiceLine(late, "Y yo que apenas estaba calentando servidores. 🤖");
    expect(rejected.personality).toBeNull();
    expect(rejected.text).not.toMatch(/calentando/i);
  });

  it("el VAR no le pone el gol a otro jugador", () => {
    const card = buildFlash({
      fixtureId: "1550982",
      eventType: "VAR",
      player: "Sebastián Jurado",
      team: "FC Juarez",
      detail: "Goal confirmed",
      homeTeam: "Leon",
      awayTeam: "FC Juarez",
      homeScore: 1,
      awayScore: 0,
      origin: "api_event",
      sources: [],
      existingStories: [],
      recentPosts: [],
    }, null);
    expect(card.lockedLines.join(" ")).toBe("El VAR confirmó el gol. Leon 1-0 FC Juarez.");
    expect(card.lockedLines.join(" ")).not.toContain("Jurado");
    const ownGoal = buildFlash({
      fixtureId: "1550982",
      eventType: "GOAL",
      minute: 76,
      player: "Francisco Nevarez",
      team: "Leon",
      detail: "Own Goal",
      homeTeam: "Leon",
      awayTeam: "FC Juarez",
      homeScore: 1,
      awayScore: 0,
      origin: "api_event",
      sources: [],
      existingStories: [],
      recentPosts: [],
    }, null);
    expect(ownGoal.lockedLines[0]).toBe("Autogol de Francisco Nevarez.");
  });

  it("no llama a OpenAI si no hay nada que decir", async () => {
    const fetchImpl = vi.fn();
    const empty = { locked: [], personality: null, text: "", voice: "plantilla" as const };
    const next = await applyVoice(empty, { OPENAI_API_KEY: "presente" }, fetchImpl);
    expect(next.voice).toBe("plantilla");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
