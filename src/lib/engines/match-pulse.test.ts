import { contradictsScore, halftimeText, pulseLine, quietSlot, readPulse } from "@/lib/engines/match-pulse";
import { describe, expect, it } from "vitest";

describe("lectura del partido", () => {
  it("sin llegadas de los dos no enseña los números", () => {
    expect(readPulse({ shotsOnTarget: 1, possession: 58 }, { shotsOnTarget: 0, possession: 42 })).toBe("nadie_llega");
    const line = pulseLine("nadie_llega", "1550982:1");
    expect(line).not.toMatch(/\d/);
    expect(line.length).toBeGreaterThan(8);
  });

  it("el 58 por ciento no se lee como dominio", () => {
    expect(readPulse({ shotsOnTarget: 1, possession: 58 }, { shotsOnTarget: 0, possession: 42 })).not.toBe("balon_sin_dano");
  });

  it("un equipo con el balón y sin daño usa la otra frase", () => {
    expect(readPulse({ shotsOnTarget: 0, possession: 70 }, { shotsOnTarget: 1, possession: 30 })).toBe("balon_sin_dano");
    expect(pulseLine("balon_sin_dano", "partido")).not.toMatch(/\d/);
  });

  it("si ya hay llegadas, no inventa una lectura", () => {
    expect(readPulse({ shotsOnTarget: 4, possession: 55 }, { shotsOnTarget: 3, possession: 45 })).toBeNull();
  });

  it("el chiste cambia de una publicación a otra", () => {
    const first = pulseLine("nadie_llega", "1550982:1");
    const second = pulseLine("nadie_llega", "1550982:1", [first]);
    expect(second).not.toBe(first);
  });

  it("el medio tiempo lleva el marcador y la frase, sin la tabla", () => {
    const text = halftimeText({
      home: "Leon",
      away: "FC Juarez",
      homeScore: 0,
      awayScore: 0,
      line: "Nadie llega. Yo aquí gastando servidores. 🤖",
    });
    expect(text).toBe("Medio tiempo.\nLeon 0-0 FC Juarez.\nNadie llega. Yo aquí gastando servidores. 🤖");
  });

  it("una cita con otro marcador no entra", () => {
    expect(contradictsScore("Juárez ya gana 1-0", 0, 0)).toBe(true);
    expect(contradictsScore("Sigue 0-0 y nadie llega", 0, 0)).toBe(false);
  });

  it("el cupo callado es uno por tiempo y no se duplica al llegar tarde", () => {
    expect(quietSlot(30, { first: false, second: false })).toBe(1);
    expect(quietSlot(30, { first: true, second: false })).toBeNull();
    expect(quietSlot(70, { first: true, second: false })).toBe(2);
    expect(quietSlot(70, { first: false, second: false })).toBe(2);
    expect(quietSlot(10, { first: false, second: false })).toBeNull();
  });
});
