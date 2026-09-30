const STOP = new Set([
  "para", "como", "esta", "este", "esto", "pero", "porque", "cuando", "sobre", "entre",
  "desde", "hasta", "donde", "tambien", "hay", "sus", "una", "unos", "unas", "con",
  "por", "que", "del", "las", "los", "muy", "mas", "todo", "toda", "todos", "todas",
  "partido", "equipo", "equipos", "hoy", "fue", "son", "esta", "estan", "dice", "dicen",
]);

export type Half = "primero" | "segundo";

export function isGoleada(home: number | null, away: number | null): boolean {
  if (home == null || away == null) return false;
  return Math.abs(home - away) >= 3;
}

export function cronHalf(input: {
  kind: string;
  key: string;
  minute: number | null;
  status: string | null;
}): Half | null {
  if (input.kind === "HALFTIME" || input.key.startsWith("halftime:")) return "primero";
  if (input.kind === "FULL_TIME" || input.key.startsWith("fulltime:")) return "segundo";
  if (input.key.startsWith("pulse:") && input.key.endsWith(":1")) return "primero";
  if (input.key.startsWith("pulse:") && input.key.endsWith(":2")) return "segundo";
  if (input.status === "HALFTIME") return "primero";
  if (input.status === "FT" || input.status === "POST_MATCH") return "segundo";
  if (input.minute == null) return null;
  return input.minute < 46 ? "primero" : "segundo";
}

export function allowsCronPost(input: {
  half: Half | null;
  usedFirst: boolean;
  usedSecond: boolean;
  homeScore: number | null;
  awayScore: number | null;
  consensus: boolean;
}): boolean {
  if (input.consensus || isGoleada(input.homeScore, input.awayScore)) return true;
  if (input.half === "primero") return !input.usedFirst;
  if (input.half === "segundo") return !input.usedSecond;
  return false;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOP.has(word));
}

export function sharedTopic(hits: Array<{ author: string | null; text: string }>): boolean {
  const authorsByWord = new Map<string, Set<string>>();
  for (const hit of hits) {
    const author = (hit.author ?? "").trim().toLowerCase();
    if (!author || !hit.text.trim()) continue;
    for (const word of tokens(hit.text)) {
      const authors = authorsByWord.get(word) ?? new Set<string>();
      authors.add(author);
      authorsByWord.set(word, authors);
    }
  }
  return [...authorsByWord.values()].some((authors) => authors.size > 3);
}
