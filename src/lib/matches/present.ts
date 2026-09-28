import type { ListedMatch } from "@/lib/db/matches";

const STATUS: Record<string, string> = {
  SCHEDULED: "Programado",
  PRE_MATCH: "Por empezar",
  LIVE: "En vivo",
  HALFTIME: "Medio tiempo",
  FT: "Final",
  POST_MATCH: "Terminado",
  CLOSED: "Cerrado",
  SUSPENDED: "Suspendido",
  RESCHEDULED: "Reprogramado",
  CANCELLED: "Cancelado",
  ABD: "Abandonado",
  STALE: "Sin cambios",
};

export function statusLabel(status: string): string {
  return STATUS[status] ?? status;
}

export function presentMatch(match: ListedMatch): { center: string; detail: string; scored: boolean } {
  const scored = match.homeScore != null && match.awayScore != null;
  if (scored) {
    const minute = match.status === "LIVE" && match.minute != null ? ` · ${match.minute}'` : "";
    return { center: `${match.homeScore}-${match.awayScore}`, detail: [match.league, `${statusLabel(match.status)}${minute}`].filter(Boolean).join(" · "), scored: true };
  }
  const when = match.kickoffAt
    ? new Intl.DateTimeFormat("es-MX", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Mexico_City",
      }).format(new Date(match.kickoffAt))
    : "Horario por confirmar";
  return { center: when, detail: [match.league, statusLabel(match.status)].filter(Boolean).join(" · "), scored: false };
}
