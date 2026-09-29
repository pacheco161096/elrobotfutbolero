import { censorSwears } from "@/lib/engines/censor";
import { contradictsScore } from "@/lib/engines/match-pulse";
import { teamSpoken } from "@/lib/engines/team-names";

export function boardNames(fixtureId: string, phase: "medio" | "final", homeTeam: string, awayTeam: string): { home: string; away: string } {
  return {
    home: teamSpoken(homeTeam, `${fixtureId}:${phase}:home`),
    away: teamSpoken(awayTeam, `${fixtureId}:${phase}:away`),
  };
}

export function boardSituation(input: {
  phase: "medio" | "final";
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  goalCount: number;
}): string {
  const when = input.phase === "medio"
    ? "Es el medio tiempo. Avisa que nos vamos al descanso."
    : "Se acabó el partido. Avisa el final.";
  const read = input.goalCount === 0
    ? "No hubo goles: se puede leer como un partido cerrado."
    : input.goalCount === 1
      ? "Hubo un solo gol."
      : "Hubo varios goles: el partido se abrió.";
  return `${when} ${input.home} contra ${input.away}. El marcador real es ${input.homeScore}-${input.awayScore}. ${read} Escribe una sola línea natural, con ese marcador escrito igual, ${input.homeScore}-${input.awayScore}, y con la voz del robot. No uses otro número. Nómbralos así, en español.`;
}

export function acceptBoardLine(raw: string, input: { homeScore: number; awayScore: number; avoid: string[] }): string | null {
  const line = censorSwears(raw).trim().replace(/^["“]|["”]$/g, "");
  if (!line || /^nada\.?$/i.test(line) || line.includes("\n") || line.length > 240) return null;
  if (!new RegExp(`(^|\\D)${input.homeScore}\\s*[-–]\\s*${input.awayScore}(\\D|$)`).test(line)) return null;
  if (contradictsScore(line, input.homeScore, input.awayScore)) return null;
  const pool = [String(input.homeScore), String(input.awayScore)];
  for (const digit of line.match(/\d+/g) ?? []) {
    const index = pool.indexOf(digit);
    if (index < 0) return null;
    pool.splice(index, 1);
  }
  const spoken = line.toLowerCase();
  if (input.avoid.some((item) => {
    const used = item.toLowerCase();
    return used.includes(spoken) || spoken.includes(used);
  })) return null;
  return line;
}
