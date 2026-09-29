import { describe, expect, it } from "vitest";
import { acceptBoardLine, boardSituation } from "@/lib/engines/scoreboard";

describe("aviso de medio tiempo y final", () => {
  it("acepta una línea natural que trae el marcador real", () => {
    expect(acceptBoardLine("Nos vamos al medio tiempo con Turquía 1-4 Italia, y esto ya se abrió. 🤖", {
      homeScore: 1,
      awayScore: 4,
      avoid: [],
    })).toMatch(/1-4/);
  });

  it("rechaza otro marcador o un minuto de más", () => {
    expect(acceptBoardLine("Nos vamos al descanso, Turquía 2-4 Italia.", { homeScore: 1, awayScore: 4, avoid: [] })).toBeNull();
    expect(acceptBoardLine("Final, Bélgica 0-0 Francia, al minuto 90.", { homeScore: 0, awayScore: 0, avoid: [] })).toBeNull();
    expect(acceptBoardLine("Partido cerrado, nos vamos al descanso.", { homeScore: 0, awayScore: 0, avoid: [] })).toBeNull();
  });

  it("el medio tiempo pide el marcador dentro de la frase", () => {
    expect(boardSituation({ phase: "medio", home: "Bélgica", away: "Francia", homeScore: 0, awayScore: 0, goalCount: 0 })).toMatch(/0-0/);
    expect(boardSituation({ phase: "final", home: "Turquía", away: "Italia", homeScore: 1, awayScore: 4, goalCount: 5 })).toMatch(/se abrió/);
  });
});
