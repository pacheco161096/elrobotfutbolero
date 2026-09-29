import { censorSwears } from "@/lib/engines/censor";

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

export function pulseSituation(input: {
  home: string;
  away: string;
  minute: number | null;
  kind: PulseKind;
  homeScore: number;
  awayScore: number;
  place: "pulso" | "medio";
}): string {
  const clock = input.minute == null ? "sin minuto confirmado" : input.minute >= 90 ? "tiempo de compensación" : input.minute >= 46 ? "segundo tiempo" : "primer tiempo";
  const when = input.minute == null ? clock : `${clock}, minuto ${input.minute}`;
  const reading = input.kind === "nadie_llega"
    ? "Ninguno de los dos está llegando con claridad al arco."
    : "Un equipo tiene la pelota y no genera peligro.";
  const place = input.place === "medio"
    ? "Es el medio tiempo. El marcador ya va en otra línea. Esta línea es el remate. Puedes decir el minuto. No pongas el marcador ni otra cifra."
    : "Es un comentario del partido callado. Puedes decir el minuto de este momento. Sin marcador y sin otra cifra.";
  return `${input.home} contra ${input.away}. ${when}. El marcador real es ${input.homeScore}-${input.awayScore}; no lo escribas. ${reading} ${place}`;
}

export function openMomentSituation(input: {
  home: string;
  away: string;
  minute: number | null;
  homeScore: number;
  awayScore: number;
}): string {
  const when = input.minute == null ? "sin minuto confirmado" : `minuto ${input.minute}`;
  return `${input.home} contra ${input.away}. Medio tiempo, ${when}. El marcador real es ${input.homeScore}-${input.awayScore}; no lo escribas. Las estadísticas no alcanzan para decir que nadie llega ni que un equipo tiene el balón sin peligro. No inventes esa lectura. Una línea del momento, o NADA.`;
}

function minuteOnly(line: string, minute: number | null): boolean {
  if (/\d+\s*[-–]\s*\d+/.test(line) || line.includes("%")) return false;
  const digits = line.match(/\d+/g) ?? [];
  if (digits.length === 0) return true;
  return minute != null && digits.every((digit) => Number(digit) === minute);
}

export function acceptMomentLine(raw: string, avoid: string[], minute: number | null): string | null {
  const line = censorSwears(raw).trim().replace(/^["“]|["”]$/g, "");
  if (!line || /^nada\.?$/i.test(line) || line.includes("\n") || line.length > 220 || !minuteOnly(line, minute)) return null;
  if (minute != null && minute >= 46 && /calentando|apenas estaba|ni se sentaban|minuto cero/i.test(line)) return null;
  const spoken = line.toLowerCase();
  if (avoid.some((item) => {
    const used = item.toLowerCase();
    return used.includes(spoken) || spoken.includes(used);
  })) return null;
  return line;
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
