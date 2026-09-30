import { NATIONAL_TEAMS } from "@/lib/engines/national-teams";

type Entry = {
  official: string;
  mexico?: boolean;
  nickname?: string;
  combined?: string;
};

const CATALOG: Array<{ keys: string[]; entry: Entry }> = [
  { keys: ["club america", "america", "cf america"], entry: { official: "América", mexico: true, nickname: "las Águilas", combined: "las Águilas del América" } },
  { keys: ["guadalajara", "chivas", "cd guadalajara"], entry: { official: "Guadalajara", mexico: true, nickname: "las Chivas", combined: "las Chivas de Guadalajara" } },
  { keys: ["monterrey", "cf monterrey", "rayados"], entry: { official: "Monterrey", mexico: true, nickname: "los Rayados", combined: "los Rayados de Monterrey" } },
  { keys: ["pumas", "unam", "u n a m pumas", "club universidad nacional"], entry: { official: "Pumas", mexico: true } },
  { keys: ["tigres", "tigres uanl"], entry: { official: "Tigres", mexico: true } },
  { keys: ["cruz azul"], entry: { official: "Cruz Azul", mexico: true, nickname: "la Máquina", combined: "la Máquina de Cruz Azul" } },
  { keys: ["toluca", "deportivo toluca"], entry: { official: "Toluca", mexico: true, nickname: "los Diablos", combined: "los Diablos de Toluca" } },
  { keys: ["leon", "club leon"], entry: { official: "León", mexico: true, nickname: "la Fiera", combined: "la Fiera de León" } },
  { keys: ["queretaro", "club queretaro"], entry: { official: "Querétaro", mexico: true, nickname: "los Gallos", combined: "los Gallos de Querétaro" } },
  { keys: ["juarez", "fc juarez"], entry: { official: "Juárez", mexico: true, nickname: "los Bravos", combined: "los Bravos de Juárez" } },
  { keys: ["necaxa"], entry: { official: "Necaxa", mexico: true, nickname: "los Rayos", combined: "los Rayos del Necaxa" } },
  { keys: ["puebla"], entry: { official: "Puebla", mexico: true, nickname: "la Franja", combined: "la Franja de Puebla" } },
  { keys: ["pachuca", "cf pachuca"], entry: { official: "Pachuca", mexico: true, nickname: "los Tuzos", combined: "los Tuzos de Pachuca" } },
  { keys: ["tijuana", "club tijuana"], entry: { official: "Tijuana", mexico: true, nickname: "los Xolos", combined: "los Xolos de Tijuana" } },
  { keys: ["atlas"], entry: { official: "Atlas", mexico: true, nickname: "los Rojinegros", combined: "los Rojinegros del Atlas" } },
  { keys: ["santos", "santos laguna"], entry: { official: "Santos Laguna", mexico: true, nickname: "Santos" } },
  { keys: ["atletico san luis", "atletico de san luis"], entry: { official: "Atlético de San Luis", mexico: true } },
  { keys: ["mazatlan", "mazatlan fc"], entry: { official: "Mazatlán", mexico: true } },
];

for (const team of NATIONAL_TEAMS) {
  CATALOG.push({
    keys: team.keys,
    entry: team.official === "México"
      ? { official: "México", mexico: true, nickname: "el Tri", combined: "el Tri de México" }
      : { official: team.official },
  });
}

function norm(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_KEY = new Map<string, Entry>();
for (const item of CATALOG) {
  for (const key of item.keys) BY_KEY.set(key, item.entry);
}

function find(name: string): Entry | null {
  const key = norm(name);
  return BY_KEY.get(key) ?? BY_KEY.get(key.replace(/^(club|cf|fc|cd|deportivo)\s+/, "")) ?? null;
}

function bare(nickname: string): string {
  return norm(nickname).replace(/^(las|los|la|el)\s+/, "");
}

function bucket(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return hash % 100;
}

export function teamOfficial(name: string): string {
  return find(name)?.official ?? name;
}

export function sameTeam(left: string, right: string): boolean {
  return norm(left) === norm(right) || teamOfficial(left) === teamOfficial(right);
}

export function teamSpoken(name: string, seed: string): string {
  const entry = find(name);
  if (!entry?.mexico || !entry.nickname) return entry?.official ?? name;
  const inside = norm(entry.official).includes(bare(entry.nickname));
  const roll = bucket(seed);
  if (inside) return roll < 70 ? entry.nickname : entry.official;
  if (roll < 35) return entry.nickname;
  if (roll < 70) return entry.combined ?? entry.nickname;
  return entry.official;
}
