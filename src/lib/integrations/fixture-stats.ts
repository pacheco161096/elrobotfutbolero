import { API_FOOTBALL_HOST } from "@/lib/integrations/api-football";
import type { SideStats } from "@/lib/engines/match-pulse";

type StatRow = { type?: string; value?: number | string | null };
type TeamBlock = { team?: { name?: string }; statistics?: StatRow[] };

function asNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function sideFrom(block: TeamBlock | undefined): SideStats | null {
  if (!block) return null;
  const onTarget = block.statistics?.find((stat) => stat.type === "Shots on Goal");
  const possession = block.statistics?.find((stat) => stat.type === "Ball Possession");
  const shotsOnTarget = asNumber(onTarget?.value);
  const share = asNumber(possession?.value);
  if (shotsOnTarget == null || share == null) return null;
  return { shotsOnTarget, possession: share };
}

export async function fetchMatchSides(
  input: { fixtureId: string; home: string; away: string; key: string; host?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ home: SideStats; away: SideStats } | null> {
  const host = input.host || API_FOOTBALL_HOST;
  const response = await fetchImpl(`https://${host}/fixtures/statistics?fixture=${encodeURIComponent(input.fixtureId)}`, {
    headers: { "x-apisports-key": input.key },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { response?: TeamBlock[]; errors?: Record<string, string> | string[] };
  const errors = body.errors;
  const errorText = Array.isArray(errors) ? errors.join(" ") : errors ? Object.values(errors).join(" ") : "";
  if (errorText) return null;
  const rows = body.response ?? [];
  const home = sideFrom(rows.find((row) => row.team?.name === input.home));
  const away = sideFrom(rows.find((row) => row.team?.name === input.away));
  if (!home || !away) return null;
  return { home, away };
}
