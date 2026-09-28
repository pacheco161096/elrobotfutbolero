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
  { keys: ["mexico", "seleccion mexicana"], entry: { official: "México", mexico: true, nickname: "el Tri", combined: "el Tri de México" } },
  { keys: ["belgium"], entry: { official: "Bélgica" } },
  { keys: ["france"], entry: { official: "Francia" } },
  { keys: ["sweden"], entry: { official: "Suecia" } },
  { keys: ["poland"], entry: { official: "Polonia" } },
  { keys: ["northern ireland"], entry: { official: "Irlanda del Norte" } },
  { keys: ["hungary"], entry: { official: "Hungría" } },
  { keys: ["romania"], entry: { official: "Rumania" } },
  { keys: ["bosnia herzegovina", "bosnia and herzegovina"], entry: { official: "Bosnia" } },
  { keys: ["turkey", "turkiye"], entry: { official: "Turquía" } },
  { keys: ["italy"], entry: { official: "Italia" } },
  { keys: ["spain"], entry: { official: "España" } },
  { keys: ["netherlands", "holland"], entry: { official: "Holanda" } },
  { keys: ["germany"], entry: { official: "Alemania" } },
  { keys: ["england"], entry: { official: "Inglaterra" } },
  { keys: ["portugal"], entry: { official: "Portugal" } },
  { keys: ["croatia"], entry: { official: "Croacia" } },
  { keys: ["czechia", "czech republic"], entry: { official: "Chequia" } },
  { keys: ["scotland"], entry: { official: "Escocia" } },
  { keys: ["switzerland"], entry: { official: "Suiza" } },
  { keys: ["slovenia"], entry: { official: "Eslovenia" } },
  { keys: ["slovakia"], entry: { official: "Eslovaquia" } },
  { keys: ["kazakhstan"], entry: { official: "Kazajistán" } },
  { keys: ["iceland"], entry: { official: "Islandia" } },
  { keys: ["luxembourg"], entry: { official: "Luxemburgo" } },
  { keys: ["bulgaria"], entry: { official: "Bulgaria" } },
  { keys: ["estonia"], entry: { official: "Estonia" } },
  { keys: ["finland"], entry: { official: "Finlandia" } },
  { keys: ["belarus"], entry: { official: "Bielorrusia" } },
  { keys: ["moldova"], entry: { official: "Moldavia" } },
  { keys: ["faroe islands"], entry: { official: "Islas Feroe" } },
  { keys: ["san marino"], entry: { official: "San Marino" } },
  { keys: ["albania"], entry: { official: "Albania" } },
  { keys: ["fyr macedonia", "north macedonia", "macedonia"], entry: { official: "Macedonia" } },
  { keys: ["austria"], entry: { official: "Austria" } },
  { keys: ["kosovo"], entry: { official: "Kosovo" } },
  { keys: ["israel"], entry: { official: "Israel" } },
  { keys: ["rep of ireland", "republic of ireland", "ireland"], entry: { official: "Irlanda" } },
  { keys: ["wales"], entry: { official: "Gales" } },
  { keys: ["norway"], entry: { official: "Noruega" } },
  { keys: ["greece"], entry: { official: "Grecia" } },
  { keys: ["serbia"], entry: { official: "Serbia" } },
  { keys: ["denmark"], entry: { official: "Dinamarca" } },
  { keys: ["lithuania"], entry: { official: "Lituania" } },
  { keys: ["azerbaijan"], entry: { official: "Azerbaiyán" } },
  { keys: ["gibraltar"], entry: { official: "Gibraltar" } },
  { keys: ["andorra"], entry: { official: "Andorra" } },
  { keys: ["malta"], entry: { official: "Malta" } },
  { keys: ["liechtenstein"], entry: { official: "Liechtenstein" } },
  { keys: ["ukraine"], entry: { official: "Ucrania" } },
  { keys: ["latvia"], entry: { official: "Letonia" } },
  { keys: ["cyprus"], entry: { official: "Chipre" } },
  { keys: ["armenia"], entry: { official: "Armenia" } },
  { keys: ["montenegro"], entry: { official: "Montenegro" } },
  { keys: ["georgia"], entry: { official: "Georgia" } },
  { keys: ["brazil"], entry: { official: "Brasil" } },
  { keys: ["argentina"], entry: { official: "Argentina" } },
  { keys: ["united states", "usa"], entry: { official: "Estados Unidos" } },
];

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
