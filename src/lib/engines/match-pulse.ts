export type SideStats = {
  shotsOnTarget: number;
  possession: number;
};

export type PulseKind = "nadie_llega" | "balon_sin_dano";

const POSSESSION_HOLD = 65;
const QUIET_ON_TARGET = 1;

const NADIE_LLEGA = [
  "Nadie llega. Yo aquí gastando servidores. 🤖",
  "Nadie llega. Hasta yo me aburrí, y eso que no siento. 🤖",
  "Se están viendo. El arco está de adorno. 🤖",
  "Ni se hacen daño. Qué partido tan educado. 🤖",
  "Nadie llega. Aquí no hay ni para el clic. 🤖",
];

const BALON_SIN_DANO = [
  "Tienen la pelota. El arco ni se entera. 🤖",
  "Mucho toque y nada de susto. 🤖",
  "Traen el balón y no lastiman. Puro adorno. 🤖",
];

export function readPulse(home: SideStats, away: SideStats): PulseKind | null {
  const homeHolds = home.possession >= POSSESSION_HOLD && home.shotsOnTarget <= QUIET_ON_TARGET;
  const awayHolds = away.possession >= POSSESSION_HOLD && away.shotsOnTarget <= QUIET_ON_TARGET;
  if (homeHolds || awayHolds) return "balon_sin_dano";
  if (home.shotsOnTarget <= QUIET_ON_TARGET && away.shotsOnTarget <= QUIET_ON_TARGET) return "nadie_llega";
  return null;
}

function pickIndex(seed: string, length: number): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return hash % length;
}

export function pulseLine(kind: PulseKind, seed: string, avoid: string[] = []): string {
  const pool = kind === "nadie_llega" ? NADIE_LLEGA : BALON_SIN_DANO;
  const start = pickIndex(seed, pool.length);
  for (let step = 0; step < pool.length; step += 1) {
    const line = pool[(start + step) % pool.length];
    if (!avoid.some((used) => used === line || used.includes(line))) return line;
  }
  return pool[start];
}

export function contradictsScore(text: string, homeScore: number, awayScore: number): boolean {
  for (const match of text.matchAll(/(\d+)\s*[-–]\s*(\d+)/g)) {
    if (Number(match[1]) !== homeScore || Number(match[2]) !== awayScore) return true;
  }
  return false;
}

export function quietSlot(minute: number | null, taken: { first: boolean; second: boolean }): 1 | 2 | null {
  if (minute == null) return null;
  if (minute >= 25 && minute < 45 && !taken.first) return 1;
  if (minute >= 65 && !taken.second && taken.first) return 2;
  if (minute >= 65 && !taken.first && !taken.second) return 2;
  return null;
}

export function halftimeText(input: { home: string; away: string; homeScore: number; awayScore: number; line: string | null }): string {
  const locked = ["Medio tiempo.", `${input.home} ${input.homeScore}-${input.awayScore} ${input.away}.`];
  return [...locked, input.line].filter((line): line is string => Boolean(line)).join("\n");
}
