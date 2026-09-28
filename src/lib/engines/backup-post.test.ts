import { describe, expect, it } from "vitest";
import { backupImageQuery, backupLocked, backupSituation } from "@/lib/engines/backup-post";

const frattesi = {
  eventType: "GOAL",
  minute: 22,
  player: "Davide Frattesi",
  team: "Italy",
  detail: "Normal Goal",
  homeTeam: "Türkiye",
  awayTeam: "Italy",
  homeScore: 0,
  awayScore: 2,
  goalNumber: 2,
  storyKey: "fixture:1528905:gol:22:Italy",
};

describe("respaldo de la jugada", () => {
  it("el segundo gol dice quién, el minuto y el marcador de esa jugada", () => {
    const locked = backupLocked(frattesi);
    expect(locked?.[0]).toBe("El segundo de Italia lo puso Davide Frattesi, al 22.");
    expect(locked?.[1]).toBe("En esa jugada quedó Turquía 0-2 Italia.");
    expect(locked?.join(" ")).not.toMatch(/Turkey|Italy|gol número|desde/);
  });

  it("un autogol no se cuenta como gol del equipo que lo metió", () => {
    const locked = backupLocked({ ...frattesi, detail: "Own Goal", goalNumber: 2, player: "Abdulkerim" });
    expect(locked?.[0]).toBe("Autogol de Abdulkerim, al 22.");
  });

  it("el medio tiempo no arma respaldo", () => {
    expect(backupLocked({ ...frattesi, eventType: "HALFTIME" })).toBeNull();
    expect(backupImageQuery({ ...frattesi, eventType: "HALFTIME" })).toBeNull();
  });

  it("la foto se busca con el jugador de la jugada", () => {
    expect(backupImageQuery(frattesi)).toBe("Davide Frattesi Türkiye Italy gol");
    expect(backupSituation(backupLocked(frattesi) ?? [])).toMatch(/no inventes un récord/);
  });
});
