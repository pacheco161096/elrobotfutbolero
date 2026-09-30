import { describe, expect, it } from "vitest";
import { buildScoreCard, scoreCardUrl } from "@/lib/engines/score-card";

const spain = [
  { minute: 89, player: "Nico Williams", team: "Spain", detail: "Normal Goal" },
  { minute: 3, player: "Lamine Yamal", team: "Spain", detail: "Normal Goal" },
  { minute: 63, player: "Lamine Yamal", team: "Spain", detail: "Normal Goal" },
  { minute: 31, player: "Pubill", team: "Spain", detail: "Normal Goal" },
  { minute: 29, player: "Beljo", team: "Croatia", detail: "Normal Goal" },
];

describe("tarjeta de marcador", () => {
  it("ordena los goles confirmados y usa bandera, no el escudo", () => {
    const card = buildScoreCard({
      homeTeam: "Spain",
      awayTeam: "Croatia",
      homeScore: 4,
      awayScore: 1,
      homeLogo: "https://media.api-sports.io/football/teams/9.png",
      awayLogo: "https://media.api-sports.io/football/teams/3.png",
      goals: spain,
    });
    expect(card?.homeCode).toBe("ESP");
    expect(card?.awayCode).toBe("CRO");
    expect(card?.homeMark).toBe("bandera");
    expect(card?.homeGoals.map((goal) => goal.minute)).toEqual([3, 31, 63, 89]);
    expect(card?.awayGoals).toEqual([{ minute: 29, name: "BELJO" }]);
  });

  it("el autogol se anota al equipo que lo recibió", () => {
    const card = buildScoreCard({
      homeTeam: "Mexico",
      awayTeam: "Spain",
      homeScore: 1,
      awayScore: 0,
      goals: [{ minute: 12, player: "Un jugador", team: "Spain", detail: "Own Goal" }],
    });
    expect(card?.homeGoals).toEqual([{ minute: 12, name: "UN JUGADOR" }]);
    expect(card?.awayGoals).toEqual([]);
  });

  it("no arma la tarjeta si falta un dato o el marcador no cuadra", () => {
    expect(buildScoreCard({
      homeTeam: "Spain",
      awayTeam: "Croatia",
      homeScore: 4,
      awayScore: 1,
      goals: spain.map((goal) => goal.minute === 3 ? { ...goal, minute: null } : goal),
    })).toBeNull();
    expect(buildScoreCard({
      homeTeam: "Spain",
      awayTeam: "Croatia",
      homeScore: 4,
      awayScore: 1,
      goals: spain.slice(1),
    })).toBeNull();
    expect(buildScoreCard({
      homeTeam: "Club America",
      awayTeam: "Guadalajara",
      homeScore: 0,
      awayScore: 0,
      goals: [],
    })).toBeNull();
  });

  it("la url pública solo sale con un sitio https", () => {
    expect(scoreCardUrl("123", {})).toBeNull();
    expect(scoreCardUrl("123", { SITE_URL: "http://local" })).toBeNull();
    expect(scoreCardUrl("abc", { SITE_URL: "https://robot.example" })).toBeNull();
    expect(scoreCardUrl("123", { SITE_URL: "https://robot.example/" })).toBe("https://robot.example/api/marcador/123");
  });
});
