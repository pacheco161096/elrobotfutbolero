import { goalKind } from "@/lib/engines/copy";
import { sameTeam, teamSpoken } from "@/lib/engines/team-names";

const ACTIONS = new Set(["GOAL", "RED_CARD", "PENALTY", "MISSED_PENALTY", "VAR"]);
const ORDINALS = ["", "primero", "segundo", "tercero", "cuarto", "quinto", "sexto"];

export type BackupEvent = {
  eventType: string;
  minute: number | null;
  player: string | null;
  team: string | null;
  detail: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  goalNumber: number | null;
  storyKey: string;
  onBench?: string[];
  notCalled?: string[];
};

function ordinal(n: number): string {
  return ORDINALS[n] ?? `número ${n}`;
}

function spokenSide(event: BackupEvent, team: string): string {
  if (sameTeam(team, event.homeTeam)) return teamSpoken(event.homeTeam, `${event.storyKey}:home`);
  if (sameTeam(team, event.awayTeam)) return teamSpoken(event.awayTeam, `${event.storyKey}:away`);
  return teamSpoken(team, `${event.storyKey}:team`);
}

function withMinute(text: string, minute: number | null): string {
  const base = text.replace(/\.$/, "");
  return minute == null ? `${base}.` : `${base}, al ${minute}.`;
}

export function backupLocked(event: BackupEvent): string[] | null {
  if (!ACTIONS.has(event.eventType)) return null;
  const side = event.team ? spokenSide(event, event.team) : null;
  const minute = event.minute;
  const lines: string[] = [];
  if (event.eventType === "GOAL") {
    const kind = goalKind(event.detail);
    const place = event.goalNumber ? `El ${ordinal(event.goalNumber)}` : "El gol";
    if (kind === "autogol") lines.push(withMinute(event.player ? `Autogol de ${event.player}` : "Autogol", minute));
    else if (event.player && side) lines.push(withMinute(`${place} de ${side}${kind === "penal" ? ", de penal," : ""} lo puso ${event.player}`, minute));
    else lines.push(withMinute(side ? `${place} de ${side}` : place, minute));
  } else if (event.eventType === "RED_CARD") {
    lines.push(withMinute([event.player ? `Expulsión de ${event.player}` : "Expulsión", side].filter(Boolean).join(", "), minute));
  } else if (event.eventType === "PENALTY") {
    lines.push(withMinute(side ? `Penal para ${side}` : "Penal", minute));
  } else if (event.eventType === "MISSED_PENALTY") {
    lines.push(withMinute(event.player ? `Penal fallado de ${event.player}` : "Penal fallado", minute));
  } else {
    lines.push(withMinute(side ? `El VAR revisó una jugada de ${side}` : "El VAR revisó la jugada", minute));
  }
  if (event.homeScore != null && event.awayScore != null) {
    const home = teamSpoken(event.homeTeam, `${event.storyKey}:home`);
    const away = teamSpoken(event.awayTeam, `${event.storyKey}:away`);
    lines.push(`En esa jugada quedó ${home} ${event.homeScore}-${event.awayScore} ${away}.`);
  }
  for (const name of event.onBench ?? []) lines.push(`${name} sigue en la banca. Se espera verlo y todavía no entra.`);
  for (const name of event.notCalled ?? []) lines.push(`${name} no está en la convocatoria de este partido.`);
  return lines;
}

export function backupImageQuery(event: BackupEvent): string | null {
  if (!ACTIONS.has(event.eventType)) return null;
  const action =
    event.eventType === "RED_CARD" ? "expulsión" :
    event.eventType === "PENALTY" || event.eventType === "MISSED_PENALTY" ? "penal" :
    event.eventType === "VAR" ? "VAR" :
    "gol";
  return [event.player, event.homeTeam, event.awayTeam, action].filter(Boolean).join(" ");
}

const WATCHED: Array<{ team: string; names: string[] }> = [
  { team: "italia", names: ["Nicolò Barella", "Moise Kean", "Gianluca Scamacca"] },
  { team: "francia", names: ["Kylian Mbappé", "Ousmane Dembélé"] },
  { team: "belgica", names: ["Romelu Lukaku"] },
  { team: "turquia", names: ["Hakan Çalhanoğlu"] },
];

function plain(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function lastName(value: string): string {
  const parts = plain(value).split(/[^a-z]+/).filter(Boolean);
  return parts.at(-1) ?? "";
}

function teamKey(name: string): string | null {
  const text = plain(name);
  if (text.includes("ital")) return "italia";
  if (text.includes("fran")) return "francia";
  if (text.includes("belg")) return "belgica";
  if (text.includes("tur")) return "turquia";
  return null;
}

export function squadNotes(input: {
  homeTeam: string;
  awayTeam: string;
  homeStarters: string[];
  homeBench: string[];
  awayStarters: string[];
  awayBench: string[];
  focusTeam?: string | null;
}): { onBench: string[]; notCalled: string[] } {
  const sides = [
    { team: input.homeTeam, starters: input.homeStarters, bench: input.homeBench },
    { team: input.awayTeam, starters: input.awayStarters, bench: input.awayBench },
  ].sort((left, right) => {
    const focus = teamKey(input.focusTeam ?? "");
    const rank = (team: string) => teamKey(team) === focus ? 0 : 1;
    return rank(left.team) - rank(right.team);
  });
  const onBench: string[] = [];
  const notCalled: string[] = [];
  for (const side of sides) {
    const key = teamKey(side.team);
    const watched = WATCHED.find((item) => item.team === key);
    if (!watched) continue;
    const starters = new Set(side.starters.map(lastName));
    const bench = new Set(side.bench.map(lastName));
    for (const name of watched.names) {
      const token = lastName(name);
      if (!token || starters.has(token)) continue;
      if (bench.has(token) && onBench.length === 0) onBench.push(name);
      if (!bench.has(token) && notCalled.length === 0) notCalled.push(name);
    }
  }
  return { onBench, notCalled };
}

export function backupSituation(locked: string[]): string {
  return `Respaldo de la jugada. El dato ya está en las líneas fijas y no se toca. Escribe una sola línea con la voz del robot. No repitas el dato, no pongas marcador ni cifras, no inventes un récord ni un "gol número". Si una línea dice que alguien sigue en la banca, puedes decir que es una estrella, que se espera mucho de él y que todavía no entra. Si una línea dice que alguien no está en la convocatoria de este partido, puedes decirlo, sin inventar el motivo. No menciones un jugador que no esté escrito abajo. Si nombras un equipo, usa el español de estas líneas:\n${locked.join("\n")}`;
}
