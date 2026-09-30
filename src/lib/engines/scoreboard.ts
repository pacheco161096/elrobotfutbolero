import { censorSwears } from "@/lib/engines/censor";
import { contradictsScore } from "@/lib/engines/match-pulse";
import { teamSpoken } from "@/lib/engines/team-names";

export function boardNames(fixtureId: string, phase: "medio" | "final", homeTeam: string, awayTeam: string): { home: string; away: string } {
  return {
    home: teamSpoken(homeTeam, `${fixtureId}:${phase}:home`),
    away: teamSpoken(awayTeam, `${fixtureId}:${phase}:away`),
  };
}

function outcome(home: string, away: string, homeScore: number, awayScore: number): string {
  if (homeScore === awayScore) return "Empate.";
  return homeScore > awayScore ? `Ganó ${home}.` : `Ganó ${away}.`;
}

export function boardSituation(input: {
  phase: "medio" | "final";
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  goalCount: number;
}): string {
  const moment = input.phase === "medio" ? "descanso" : "cierre";
  const read = input.goalCount === 0
    ? "No hubo goles: partido cerrado."
    : input.goalCount === 1
      ? "Hubo un solo gol."
      : "Hubo varios goles: el partido se abrió.";
  return [
    `Hechos del ${moment}.`,
    `Local: ${input.home}.`,
    `Visita: ${input.away}.`,
    `Marcador, escríbelo tal cual: ${input.homeScore}-${input.awayScore}.`,
    outcome(input.home, input.away, input.homeScore, input.awayScore),
    read,
    "Una sola publicación, dicha de corrido, con tu voz. Los dos nombres y ese marcador van dentro de la frase, no como ficha suelta. No uses otro número. Nómbralos así, en español. No abras igual que una publicación reciente.",
  ].join(" ");
}

function spokenWords(line: string): string {
  return line
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameOpening(line: string, previous: string): boolean {
  const next = spokenWords(line).split(" ").slice(0, 4).join(" ");
  const used = spokenWords(previous).split(" ").slice(0, 4).join(" ");
  return next.length > 0 && next === used;
}

export function acceptBoardLine(raw: string, input: { homeScore: number; awayScore: number; avoid: string[] }): string | null {
  const line = censorSwears(raw).trim().replace(/^["“]|["”]$/g, "");
  if (!line || /^nada\.?$/i.test(line) || line.includes("\n") || line.length > 240) return null;
  if (spokenWords(line).includes("se acabo el partido")) return null;
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
    return used.includes(spoken) || spoken.includes(used) || sameOpening(line, item);
  })) return null;
  return line;
}
