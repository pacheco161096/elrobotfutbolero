const SCORE = /\d+\s*[-–]\s*\d+/;
const GENERIC = new Set(["futbol", "total", "mexico", "deportes", "noticias", "oficial", "facebook", "pagina", "page", "sport", "sports", "publicacion", "publica"]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesPage(line: string, author: string): boolean {
  const text = normalize(line);
  const name = normalize(author);
  if (!name || name === "publicacion publica") return false;
  if (text === name || text.startsWith(`${name} `)) return true;
  const tokens = name.split(" ").filter((token) => token.length >= 4 && !GENERIC.has(token));
  return tokens.some((token) => text.includes(token));
}

export function copiesPage(line: string, source: string): boolean {
  const spoken = normalize(line);
  const original = normalize(source);
  if (spoken.length >= 18 && original.includes(spoken)) return true;
  const words = original.split(" ").filter((word) => word.length >= 2);
  for (let index = 0; index <= words.length - 5; index += 1) {
    const window = words.slice(index, index + 5).join(" ");
    if (window.length >= 18 && spoken.includes(window)) return true;
  }
  return false;
}

export function acceptPageLine(source: string, author: string, raw: string): string | null {
  const line = raw.trim().replace(/^["“]|["”]$/g, "");
  if (!line || /^nada\.?$/i.test(line) || line.includes("\n")) return null;
  if (line.length > 220 || SCORE.test(line)) return null;
  if (namesPage(line, author) || copiesPage(line, source)) return null;
  return line;
}
