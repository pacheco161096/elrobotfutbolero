function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function imageRoute(_input: { eventType: string; source: string; line: string }): "buscar" | "crear" {
  return "buscar";
}

export function matchImageQuery(input: { home: string; away: string; eventType: string }): string {
  const action =
    input.eventType === "RED_CARD" ? "expulsión" :
    input.eventType === "PENALTY" || input.eventType === "MISSED_PENALTY" ? "penal" :
    input.eventType === "VAR" ? "VAR" :
    "gol";
  return `${input.home} vs ${input.away} ${action}`;
}

export function memeScene(line: string): string {
  return analysisScene({ goalCount: /aburr|nadie|lento|cerrad|sin goles/.test(normalize(line)) ? 0 : 2, line });
}

export function analysisScene(input: { goalCount: number; line: string }): string {
  const text = normalize(input.line);
  const quiet = input.goalCount === 0 || /aburr|nadie|lento|cerrad|sin goles|empate/.test(text);
  if (quiet) return "the robot half asleep at the desk, bored, chin on one hand, a dull football match on a dark screen, no text, no crests, no real players";
  return "the robot leaning forward, amused, reacting to a lively football match on a dark screen, no text, no club crests, no real players";
}
