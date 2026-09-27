import type { EventType, Importance, IncomingEvent } from "@/lib/domain/types";

const RANK: Record<Importance, number> = {
  IGNORAR: 0,
  BAJO: 1,
  MEDIO: 2,
  ALTO: 3,
  MUY_ALTO: 4,
};

export function importanceRank(value: Importance): number {
  return RANK[value];
}

export function classifyImportance(event: IncomingEvent): Importance {
  if (event.eventType === "GOAL") {
    const gap = Math.abs((event.homeScore ?? 0) - (event.awayScore ?? 0));
    if ((event.minute ?? 0) >= 80 && gap <= 1) return "MUY_ALTO";
    return "ALTO";
  }
  const veryHigh = new Set<EventType>([
    "RED_CARD",
    "PENALTY",
    "MISSED_PENALTY",
    "VAR",
    "SUSPENDED",
    "RESUMPTION",
    "FULL_TIME",
    "INCIDENT",
    "CANCELLED",
  ]);
  if (veryHigh.has(event.eventType)) return "MUY_ALTO";
  if (event.eventType === "INJURY" || event.eventType === "HALFTIME") return "ALTO";
  if (event.eventType === "STATEMENT") return event.impact === "important" ? "ALTO" : "MEDIO";
  if (event.eventType === "SUBSTITUTION") return event.impact === "important" ? "ALTO" : "BAJO";
  if (event.eventType === "REACTION" || event.eventType === "COMPLAINT" || event.eventType === "STAT") return "MEDIO";
  if (event.eventType === "YELLOW_CARD" || event.eventType === "CORNER" || event.eventType === "RESCHEDULED") return "BAJO";
  return "BAJO";
}
