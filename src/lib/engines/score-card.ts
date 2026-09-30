import { sameTeam } from "@/lib/engines/team-names";
import { markImage } from "@/lib/engines/team-marks";

export type CardGoal = { minute: number; name: string };

export type ScoreCardFacts = {
  homeCode: string;
  awayCode: string;
  homeMarkUrl: string;
  awayMarkUrl: string;
  homeMark: "bandera" | "escudo";
  awayMark: "bandera" | "escudo";
  homeScore: number;
  awayScore: number;
  homeGoals: CardGoal[];
  awayGoals: CardGoal[];
};

export type ScoreGoalInput = {
  minute: number | null;
  player: string | null;
  team: string | null;
  detail: string | null;
};

function goalName(player: string): string | null {
  const name = player.replace(/\s+/g, " ").trim().toUpperCase();
  if (!name || !/^[\p{L}\p{N} .'-]+$/u.test(name)) return null;
  return name;
}

function sideOf(goal: ScoreGoalInput, homeTeam: string, awayTeam: string): "home" | "away" | null {
  if (!goal.team) return null;
  const home = sameTeam(goal.team, homeTeam);
  const away = sameTeam(goal.team, awayTeam);
  if (home === away) return null;
  const own = /own/i.test(goal.detail ?? "");
  if (own) return home ? "away" : "home";
  return home ? "home" : "away";
}

export function logoFromRaw(raw: unknown, side: "home" | "away"): string | null {
  if (!raw || typeof raw !== "object") return null;
  const logo = (raw as { teams?: { home?: { logo?: unknown }; away?: { logo?: unknown } } }).teams?.[side]?.logo;
  return typeof logo === "string" && logo.startsWith("https://") ? logo : null;
}

export function scoreCardUrl(fixtureId: string, env: Record<string, string | undefined>): string | null {
  const site = env.SITE_URL?.replace(/\/$/, "");
  if (!site?.startsWith("https://") || !/^\d+$/.test(fixtureId)) return null;
  return `${site}/api/marcador/${fixtureId}`;
}

export function buildScoreCard(input: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  homeLogo?: string | null;
  awayLogo?: string | null;
  goals: ScoreGoalInput[];
}): ScoreCardFacts | null {
  if (input.homeScore == null || input.awayScore == null || input.homeScore < 0 || input.awayScore < 0) return null;
  const homeMark = markImage(input.homeTeam, input.homeLogo ?? null);
  const awayMark = markImage(input.awayTeam, input.awayLogo ?? null);
  if (!homeMark || !awayMark) return null;
  const homeGoals: CardGoal[] = [];
  const awayGoals: CardGoal[] = [];
  const ordered = input.goals.map((goal, index) => ({ goal, index })).sort((left, right) => {
    return (left.goal.minute ?? 0) - (right.goal.minute ?? 0) || left.index - right.index;
  });
  for (const item of ordered) {
    if (item.goal.minute == null || !item.goal.player) return null;
    const name = goalName(item.goal.player);
    const side = sideOf(item.goal, input.homeTeam, input.awayTeam);
    if (!name || !side) return null;
    (side === "home" ? homeGoals : awayGoals).push({ minute: item.goal.minute, name });
  }
  if (homeGoals.length !== input.homeScore || awayGoals.length !== input.awayScore) return null;
  return {
    homeCode: homeMark.code,
    awayCode: awayMark.code,
    homeMarkUrl: homeMark.url,
    awayMarkUrl: awayMark.url,
    homeMark: homeMark.kind,
    awayMark: awayMark.kind,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    homeGoals,
    awayGoals,
  };
}
