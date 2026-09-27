import { CADENCE } from "@/lib/engines/cadence";

export type MatchStatus =
  | "SCHEDULED"
  | "PRE_MATCH"
  | "LIVE"
  | "HALFTIME"
  | "FT"
  | "POST_MATCH"
  | "CLOSED"
  | "SUSPENDED"
  | "RESCHEDULED"
  | "CANCELLED"
  | "ABD"
  | "STALE";

const API_STATUS: Record<string, MatchStatus> = {
  NS: "SCHEDULED",
  TBD: "SCHEDULED",
  "1H": "LIVE",
  HT: "HALFTIME",
  "2H": "LIVE",
  ET: "LIVE",
  BT: "LIVE",
  P: "LIVE",
  LIVE: "LIVE",
  FT: "FT",
  AET: "FT",
  PEN: "FT",
  SUSP: "SUSPENDED",
  INT: "SUSPENDED",
  PST: "RESCHEDULED",
  CANC: "CANCELLED",
  ABD: "ABD",
  AWD: "FT",
  WO: "FT",
};

export function statusFromApi(short: string, kickoffIso: string | null, now: Date): MatchStatus | null {
  const mapped = API_STATUS[short];
  if (!mapped) return null;
  if (mapped === "SCHEDULED" && kickoffIso) {
    const delta = new Date(kickoffIso).getTime() - now.getTime();
    if (delta <= CADENCE.preMatchWindowMs && delta > -5 * 60_000) return "PRE_MATCH";
  }
  return mapped;
}

export function pollingIntervalMs(status: MatchStatus): number | null {
  if (status === "LIVE" || status === "HALFTIME") return CADENCE.livePollMs;
  if (status === "SUSPENDED") return CADENCE.suspendedPollMs;
  if (status === "STALE") return CADENCE.stalePollMs;
  if (status === "PRE_MATCH") return 60_000;
  return null;
}

export function transition(
  current: MatchStatus,
  signal: { type: "api"; status: MatchStatus } | { type: "kickoff_soon" } | { type: "unchanged" },
  suspendedUnchangedMs = 0,
): { status: MatchStatus; effects: string[] } {
  if (current === "CLOSED" || current === "CANCELLED" || current === "ABD") {
    return { status: current, effects: [] };
  }
  if (signal.type === "kickoff_soon") {
    if (current === "SCHEDULED") return { status: "PRE_MATCH", effects: [] };
    return { status: current, effects: [] };
  }
  if (signal.type === "unchanged") {
    if ((current === "SUSPENDED" || current === "STALE") && suspendedUnchangedMs >= CADENCE.staleAfterMs) {
      return { status: "STALE", effects: ["bajar_frecuencia"] };
    }
    return { status: current, effects: [] };
  }

  const next = signal.status;
  const effects: string[] = [];
  if (current === "LIVE" && next === "SUSPENDED") effects.push("monitor_de_suspension", "polling_90s");
  if ((current === "SUSPENDED" || current === "STALE") && next === "LIVE") {
    effects.push("reanudar_polling_15s", "evento_RESUMPTION", "evaluar_publicacion");
  }
  if (current === "SUSPENDED" && next === "RESCHEDULED") effects.push("guardar_nueva_fecha");
  if (next === "FT") effects.push("cerrar_resultado");
  if (current === "STALE" && next !== "STALE") effects.push("reactivar_por_cambio");
  return { status: next, effects };
}

export function syncWindow(now: Date): { from: string; to: string } {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + 3);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export type WatchdogFinding = { code: string; message: string; ref: string };

export function watchdogFindings(input: {
  now: Date;
  matches: Array<{ id: string; status: MatchStatus; lastPolledAt: string | null }>;
  jobs: Array<{ id: string; status: string }>;
  workerLastSeenAt: string | null;
}): WatchdogFinding[] {
  const findings: WatchdogFinding[] = [];
  for (const match of input.matches) {
    if (match.status !== "LIVE" && match.status !== "HALFTIME") continue;
    const stale = !match.lastPolledAt || input.now.getTime() - new Date(match.lastPolledAt).getTime() > 2 * 60_000;
    if (stale) findings.push({ code: "match_stuck", message: "Partido en vivo sin sondeo reciente.", ref: match.id });
  }
  for (const job of input.jobs) {
    if (job.status === "failed") findings.push({ code: "job_failed", message: "Job fallido.", ref: job.id });
  }
  if (input.workerLastSeenAt) {
    const silent = input.now.getTime() - new Date(input.workerLastSeenAt).getTime() > CADENCE.watchdogMs;
    if (silent) findings.push({ code: "worker_silent", message: "El worker no ha respondido.", ref: "live-worker" });
  }
  return findings;
}
