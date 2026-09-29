import { describe, expect, it, vi } from "vitest";
import { acceptVoiceLine, composeDraft, voiceFits } from "@/lib/engines/copy";
import { teamSpoken } from "@/lib/engines/team-names";
import { buildFlash } from "@/lib/engines/flash";
import { interpretInstructions } from "@/lib/engines/voice-brief";
import { applyVoice, voiceInstructions } from "@/lib/integrations/openai-voice";

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

  it("si el modelo repite el dato fijo, esa frase no se publica", () => {
    const next = acceptVoiceLine(draft, "Entre el minuto 9 y el 27, Italia metió tres goles. ¿Y ahora qué?");
    const repeated = acceptVoiceLine({
      ...draft,
      locked: ["Entre el minuto 9 y el 27, Italia metió tres goles.", "Ahora van Turquía 0-3 Italia."],
    }, "Entre el 9 y el 27, Italia metió tres goles. ¿Y ahora qué?");
    expect(next.voice).toBe("openai");
    expect(repeated.voice).toBe("plantilla");
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
    const home = teamSpoken("Leon", "1550982:VAR:home");
    const away = teamSpoken("FC Juarez", "1550982:VAR:away");
    expect(card.lockedLines.join(" ")).toBe(`El VAR confirmó el gol. ${home} 1-0 ${away}.`);
    expect(card.lockedLines.join(" ")).not.toMatch(/Juarez|Leon/);
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

  it("la voz usa el diccionario y la tendencia en su línea", () => {
    const withEar = voiceInstructions("Cómo se habla:\n- Cierran la queja con un neta.", "No cambias el dato.");
    const without = voiceInstructions("", "No cambias el dato.");
    expect(withEar).toContain("BOT DE FÚTBOL MEXICANO");
    expect(withEar).toContain("REGLA DE ORO");
    expect(withEar).not.toContain("SISTEMA OPERATIVO DE DECISIÓN");
    expect(withEar).toContain("La línea de tu voz sale de aquí");
    expect(withEar).toContain("esa línea de voz la usa");
    expect(interpretInstructions("Cómo se habla:\n- Cierran la queja con un neta.", "Interpretas.")).toContain("obligatorio tomarlo en cuenta al interpretar");
    expect(withEar).toContain("Cierran la queja con un neta.");
    expect(withEar).toContain("Ortografía correcta");
    expect(withEar.indexOf("No cambias el dato.")).toBeGreaterThan(withEar.indexOf("Cierran la queja"));
    expect(without).toContain("BOT DE FÚTBOL MEXICANO");
    expect(without).toContain("Diccionario de frases y tendencias");
    expect(without).toContain("Todavía no hay frases");
    expect(voiceInstructions("Cierran la queja con un pendejo.", "No cambias el dato.")).toContain("con un p*ndejo");
    expect(interpretInstructions("", "Interpretas.")).toContain("SISTEMA OPERATIVO DE DECISIÓN");
  });

  it("no llama a OpenAI si no hay nada que decir", async () => {
    const fetchImpl = vi.fn();
    const empty = { locked: [], personality: null, text: "", voice: "plantilla" as const };
    const next = await applyVoice(empty, { OPENAI_API_KEY: "presente" }, fetchImpl);
    expect(next.voice).toBe("plantilla");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
