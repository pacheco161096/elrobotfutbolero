import { acceptMomentLine, contradictsScore, halftimeText, pulseLine, pulseSituation, quietSlot, readPulse } from "@/lib/engines/match-pulse";
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

  it("la frase del partido callado puede decir el minuto y no el marcador", () => {
    const situation = pulseSituation({
      home: "Belgium",
      away: "France",
      minute: 70,
      kind: "nadie_llega",
      homeScore: 0,
      awayScore: 0,
      place: "pulso",
    });
    expect(situation).toContain("segundo tiempo");
    expect(situation).toContain("no lo escribas");
    expect(acceptMomentLine("Se están mirando y el arco descansa. 🤖", ["Nadie llega. Yo aquí gastando servidores. 🤖"], 70)).toBe(
      "Se están mirando y el arco descansa. 🤖",
    );
    expect(acceptMomentLine("Nadie llega. Yo aquí gastando servidores. 🤖", ["Nadie llega. Yo aquí gastando servidores. 🤖"], 30)).toBeNull();
    expect(acceptMomentLine("Minuto 70. Partido más aburrido que una serie de TV sin trama.", [], 70)).toBe(
      "Minuto 70. Partido más aburrido que una serie de TV sin trama.",
    );
    expect(acceptMomentLine("Minuto 12. Esto no es el momento.", [], 70)).toBeNull();
    expect(acceptMomentLine("Van 0-0 y yo aquí.", [], 30)).toBeNull();
    expect(acceptMomentLine("Apenas estaba calentando servidores. 🤖", [], 70)).toBeNull();
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
