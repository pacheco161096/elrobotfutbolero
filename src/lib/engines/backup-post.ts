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

export function backupSituation(locked: string[]): string {
  return `Respaldo de la jugada. El dato ya está en las líneas fijas y no se toca. Escribe una sola línea con la voz del robot. No repitas el dato, no pongas marcador ni cifras, no inventes un récord ni un "gol número". Si nombras un equipo, usa el español de estas líneas:\n${locked.join("\n")}`;
}
