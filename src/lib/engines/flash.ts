import type { IncomingEvent } from "@/lib/domain/types";
import type { ClaimStatus } from "@/lib/domain/types";

export type FlashCard = {
  valid: boolean;
  missing: string[];
  facts: Record<string, string | number>;
  lockedLines: string[];
  causeMode: "omit" | "confirmed" | "contradicted" | "none";
};

function scoreMissing(event: IncomingEvent): string[] {
  const missing: string[] = [];
  if (event.homeScore == null) missing.push("home_score");
  if (event.awayScore == null) missing.push("away_score");
  return missing;
}

function scoreLine(event: IncomingEvent): string {
  return `${event.homeTeam} ${event.homeScore}-${event.awayScore} ${event.awayTeam}.`;
}

export function buildFlash(event: IncomingEvent, causeStatus: ClaimStatus | null): FlashCard {
  const facts: Record<string, string | number> = {
    event_type: event.eventType,
    home_team: event.homeTeam,
    away_team: event.awayTeam,
  };
  if (event.minute != null) facts.minute = event.minute;
  if (event.player) facts.player = event.player;
  if (event.team) facts.team = event.team;
  if (event.homeScore != null && event.awayScore != null) {
    facts.home_score = event.homeScore;
    facts.away_score = event.awayScore;
  }

  const missing: string[] = [];
  const lockedLines: string[] = [];
  let causeMode: FlashCard["causeMode"] = "none";

  if (event.eventType === "GOAL") {
    if (!event.team) missing.push("equipo que anotó");
    if (!event.player) missing.push("goleador");
    if (event.minute == null) missing.push("minuto");
    missing.push(...scoreMissing(event).map(() => "marcador actualizado"));
    if (missing.length === 0) {
      lockedLines.push(`⚽ GOOOOL DE ${event.team?.toUpperCase()}.`, scoreLine(event));
    }
  } else if (event.eventType === "RED_CARD") {
    if (!event.player) missing.push("jugador");
    if (!event.team) missing.push("equipo");
    if (event.player && event.team) lockedLines.push(`Expulsión de ${event.player}, ${event.team}.`);
    if (event.homeScore != null && event.awayScore != null) lockedLines.push(scoreLine(event));
  } else if (event.eventType === "PENALTY") {
    if (!event.team) missing.push("equipo beneficiado");
    missing.push(...scoreMissing(event).map(() => "marcador actual"));
    if (event.team && event.homeScore != null && event.awayScore != null) {
      lockedLines.push(`Penal para ${event.team}.`, scoreLine(event));
    }
  } else if (event.eventType === "MISSED_PENALTY") {
    if (!event.player && !event.team) missing.push("jugador o equipo");
    missing.push(...scoreMissing(event).map(() => "marcador"));
    const who = event.player ?? event.team;
    if (who && event.homeScore != null && event.awayScore != null) {
      lockedLines.push(`Penal fallado de ${who}.`, scoreLine(event));
    }
  } else if (event.eventType === "HALFTIME" || event.eventType === "FULL_TIME") {
    missing.push(...scoreMissing(event).map(() => event.eventType === "FULL_TIME" ? "resultado final" : "marcador"));
    if (event.homeScore != null && event.awayScore != null) {
      lockedLines.push(event.eventType === "FULL_TIME" ? "Final." : "Medio tiempo.", scoreLine(event));
    }
  } else if (event.eventType === "VAR") {
    const detail = (event.detail ?? "").toLowerCase();
    const outcome = detail.includes("cancel") || detail.includes("disallow") || detail.includes("anul")
      ? "anuló el gol"
      : detail.includes("penalty confirmed") || detail.includes("penal confirmado")
        ? "confirmó el penal"
        : detail.includes("goal confirmed") || detail.includes("gol confirmado")
          ? "confirmó el gol"
          : null;
    if (outcome && (event.homeScore == null || event.awayScore == null)) missing.push("marcador");
    if (!outcome || (event.homeScore != null && event.awayScore != null)) {
      lockedLines.push(outcome ? `El VAR ${outcome}.` : "El VAR revisa una jugada.");
      if (outcome && event.homeScore != null && event.awayScore != null) lockedLines.push(scoreLine(event));
    }
  } else if (event.eventType === "SUSPENDED") {
    causeMode = "omit";
    if (causeStatus === "CONFIRMED" && event.cause?.text) {
      causeMode = "confirmed";
      facts.cause = event.cause.text;
      lockedLines.push(`⚠️ Partido suspendido por ${event.cause.text}.`);
    } else if (causeStatus === "CONTRADICTED") {
      causeMode = "contradicted";
      lockedLines.push("⚠️ Hay versiones distintas sobre por qué se suspendió el partido. Estoy revisando cuál es la correcta. 🤖");
    } else {
      lockedLines.push(
        "⚠️ SE SUSPENDE EL PARTIDO.",
        "El partido no continuará en este momento. Estoy investigando qué pasó. 🤖",
      );
    }
  }

  const uniqueMissing = [...new Set(missing)];
  return { valid: uniqueMissing.length === 0, missing: uniqueMissing, facts, lockedLines, causeMode };
}
