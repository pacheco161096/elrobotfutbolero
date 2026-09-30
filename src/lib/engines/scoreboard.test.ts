import { describe, expect, it } from "vitest";
import { acceptBoardLine, boardSituation } from "@/lib/engines/scoreboard";

describe("aviso de medio tiempo y final", () => {
  it("acepta una línea natural que trae el marcador real", () => {
    expect(acceptBoardLine("Nos vamos al medio tiempo con Turquía 1-4 Italia, y esto ya se abrió. 🤖", {
      phase: "medio",
      homeScore: 1,
      awayScore: 4,
      avoid: [],
    })).toMatch(/1-4/);
    expect(acceptBoardLine("El Tri de México se quedó con las ganas, porque Perú se llevó la victoria 0-1 y ya están pensando en el siguiente partido. 🤖", {
      phase: "medio",
      homeScore: 0,
      awayScore: 1,
      avoid: [],
    })).toBeNull();
  });

  it("rechaza otro marcador o un minuto de más", () => {
    expect(acceptBoardLine("Nos vamos al descanso, Turquía 2-4 Italia.", { homeScore: 1, awayScore: 4, avoid: [] })).toBeNull();
    expect(acceptBoardLine("Final, Bélgica 0-0 Francia, al minuto 90.", { homeScore: 0, awayScore: 0, avoid: [] })).toBeNull();
    expect(acceptBoardLine("Partido cerrado, nos vamos al descanso.", { homeScore: 0, awayScore: 0, avoid: [] })).toBeNull();
  });

  it("rechaza el arranque fijo y una apertura ya usada", () => {
    expect(acceptBoardLine("España le puso un 4-1 a Croacia y se fue a celebrar. 🤖", {
      homeScore: 4,
      awayScore: 1,
      avoid: [],
    })).toMatch(/4-1/);
    expect(acceptBoardLine("Se acabó el partido. España 4-1 Croacia. Croacia se fue con las manos vacías. 🤖", {
      homeScore: 4,
      awayScore: 1,
      avoid: [],
    })).toBeNull();
    expect(acceptBoardLine("España le puso un 4-1 a Croacia, otra vez. 🤖", {
      homeScore: 4,
      awayScore: 1,
      avoid: ["España le puso un 4-1 a Croacia y se fue a celebrar. 🤖"],
    })).toBeNull();
  });

  it("el cierre entrega hechos, no una frase para copiar", () => {
    const medio = boardSituation({ phase: "medio", home: "México", away: "Perú", homeScore: 0, awayScore: 1, goalCount: 1 });
    const quieto = boardSituation({ phase: "medio", home: "Bélgica", away: "Francia", homeScore: 0, awayScore: 0, goalCount: 0 });
    const final = boardSituation({ phase: "final", home: "Turquía", away: "Italia", homeScore: 1, awayScore: 4, goalCount: 5 });
    expect(medio).toMatch(/0-1/);
    expect(medio).toMatch(/segundo tiempo/);
    expect(medio).not.toMatch(/Ganó/);
    expect(quieto).not.toMatch(/partido cerrado/);
    expect(quieto).not.toMatch(/Empate/);
    expect(final).toMatch(/se abrió/);
    expect(final).toMatch(/Ganó Italia/);
    expect(final).not.toMatch(/Se acabó el partido/);
  });
});
