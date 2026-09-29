const WORDS = [
  "pendejadas", "pendejada", "pendejos", "pendejas", "pendejo", "pendeja",
  "chingaderas", "chingadera", "chingados", "chingadas", "chingado", "chingada",
  "chingonas", "chingona", "chingones", "chingón", "chingon", "chingar", "chingas", "chinga",
  "cabrones", "cabronas", "cabrona", "cabrón", "cabron",
  "jodidos", "jodidas", "jodido", "jodida", "joder", "jodes", "jode",
  "culeros", "culeras", "culero", "culera",
  "mamones", "mamona", "mamón", "mamon", "mames",
  "pinches", "pinche",
  "mierdas", "mierda",
  "vergas", "verga",
  "putos", "putas", "puto", "puta",
  "carajo",
].sort((left, right) => right.length - left.length);

const PHRASES = [/valieron madre/giu, /valiendo madre/giu, /vale madre/giu];

function censorToken(word: string): string {
  const chars = Array.from(word);
  const index = chars.findIndex((char) => /[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]/.test(char));
  if (index < 0) return word;
  chars[index] = "*";
  return chars.join("");
}

function censorPhrase(match: string): string {
  return match.split(/(\s+)/).map((part) => (/\s/.test(part) ? part : censorToken(part))).join("");
}

export function censorSwears(text: string): string {
  let next = text;
  for (const phrase of PHRASES) next = next.replace(phrase, censorPhrase);
  for (const word of WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}*])${escaped}(?![\\p{L}\\p{N}*])`, "giu");
    next = next.replace(pattern, censorToken);
  }
  return next;
}
