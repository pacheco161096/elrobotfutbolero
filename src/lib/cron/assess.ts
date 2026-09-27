import { CADENCE } from "@/lib/engines/cadence";
import type { WatchdogFinding } from "@/lib/engines/match-state";

const SETTLED = new Set(["FT", "POST_MATCH", "CLOSED", "CANCELLED", "ABD"]);
const ACTIVE_EVENTS = new Set(["LIVE", "HALFTIME", "SUSPENDED", "STALE"]);
const RECENT_FINISH_MS = 3 * 60 * 60_000;

export function shouldFetchEvents(input: { status: string; kickoffAt: string | null; eventCount: number; now: Date }): boolean {
  if (ACTIVE_EVENTS.has(input.status)) return true;
  if (input.status !== "FT" && input.status !== "POST_MATCH" && input.status !== "ABD") return false;
  if (input.eventCount === 0) return true;
  if (!input.kickoffAt) return false;
  return input.now.getTime() - new Date(input.kickoffAt).getTime() < RECENT_FINISH_MS;
}

export type ScheduledFixture = {
  fixtureId: string;
  status: string;
  kickoffAt: string | null;
};

export function assessSchedule(matches: ScheduledFixture[], now: Date): { preMatch: string[]; refresh: boolean } {
  const preMatch: string[] = [];
  let refresh = false;
  for (const match of matches) {
    if (!match.kickoffAt) continue;
    const delta = new Date(match.kickoffAt).getTime() - now.getTime();
    if (match.status === "SCHEDULED" && delta <= CADENCE.preMatchWindowMs && delta > -5 * 60_000) {
      preMatch.push(match.fixtureId);
    }
    const started = delta < -5 * 60_000;
    if (started && !SETTLED.has(match.status)) refresh = true;
  }
  return { preMatch, refresh };
}

export function inconsistentFindings(matches: ScheduledFixture[], now: Date): WatchdogFinding[] {
  const findings: WatchdogFinding[] = [];
  for (const match of matches) {
    if (!match.kickoffAt || (match.status !== "SCHEDULED" && match.status !== "PRE_MATCH")) continue;
    const late = now.getTime() - new Date(match.kickoffAt).getTime() > 15 * 60_000;
    if (late) {
      findings.push({
        code: "state_inconsistent",
        message: "El partido ya debió empezar y sigue programado.",
        ref: match.fixtureId,
      });
    }
  }
  return findings;
}
