const MATCH_ACTIONS = new Set(["GOAL", "RED_CARD", "PENALTY", "MISSED_PENALTY", "VAR"]);
const JOKE = /\b(empate|recor|pensar|epoca|prest|mandaron|aburr|hueva|rey)\b/;
const ACTION = /g+o+l+|autogol|penal|expuls|roja|\bvar\b/;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function imageRoute(input: { eventType: string; source: string; line: string }): "buscar" | "crear" {
  const source = normalize(input.source);
  const line = normalize(input.line);
  const joke = JOKE.test(`${source} ${line}`) && !ACTION.test(line);
  if (joke && (!MATCH_ACTIONS.has(input.eventType) || JOKE.test(source))) return "crear";
  if (MATCH_ACTIONS.has(input.eventType) && ACTION.test(source)) return "buscar";
  if (ACTION.test(line)) return "buscar";
  return "crear";
}

export function matchImageQuery(input: { home: string; away: string; eventType: string }): string {
  const action =
    input.eventType === "RED_CARD" ? "expulsión" :
    input.eventType === "PENALTY" || input.eventType === "MISSED_PENALTY" ? "penal" :
    input.eventType === "VAR" ? "VAR" :
    "gol";
  return `${input.home} vs ${input.away} ${action} Liga MX`;
}

export function memeScene(line: string): string {
  const text = normalize(line);
  if (text.includes("empate")) return "the robot staring at a scoreboard that just changed, surprised, no text, no crests, no real players";
  if (text.includes("aburr") || text.includes("nadie")) return "the robot half asleep in front of a dark screen, still at the desk, no text, no crests";
  return "the robot reacting to a football conversation, square green head, no text, no club crests, no real players";
}
