import { teamOfficial } from "@/lib/engines/team-names";

type Mark = { code: string; flag: string | null };

const MARKS: Record<string, Mark> = {
  América: { code: "AME", flag: null },
  Guadalajara: { code: "GDL", flag: null },
  Monterrey: { code: "MTY", flag: null },
  Pumas: { code: "UNAM", flag: null },
  Tigres: { code: "TIG", flag: null },
  "Cruz Azul": { code: "CAZ", flag: null },
  Toluca: { code: "TOL", flag: null },
  León: { code: "LEO", flag: null },
  Querétaro: { code: "QRO", flag: null },
  Juárez: { code: "JUA", flag: null },
  Necaxa: { code: "NEC", flag: null },
  Puebla: { code: "PUE", flag: null },
  Pachuca: { code: "PAC", flag: null },
  Tijuana: { code: "TIJ", flag: null },
  Atlas: { code: "ATL", flag: null },
  "Santos Laguna": { code: "SAN", flag: null },
  "Atlético de San Luis": { code: "ASL", flag: null },
  Mazatlán: { code: "MAZ", flag: null },
  México: { code: "MEX", flag: "mx" },
  Bélgica: { code: "BEL", flag: "be" },
  Francia: { code: "FRA", flag: "fr" },
  Suecia: { code: "SWE", flag: "se" },
  Polonia: { code: "POL", flag: "pl" },
  "Irlanda del Norte": { code: "NIR", flag: "gb-nir" },
  Hungría: { code: "HUN", flag: "hu" },
  Rumania: { code: "ROU", flag: "ro" },
  Bosnia: { code: "BIH", flag: "ba" },
  Turquía: { code: "TUR", flag: "tr" },
  Italia: { code: "ITA", flag: "it" },
  España: { code: "ESP", flag: "es" },
  Holanda: { code: "NED", flag: "nl" },
  Alemania: { code: "GER", flag: "de" },
  Inglaterra: { code: "ENG", flag: "gb-eng" },
  Portugal: { code: "POR", flag: "pt" },
  Croacia: { code: "CRO", flag: "hr" },
  Chequia: { code: "CZE", flag: "cz" },
  Escocia: { code: "SCO", flag: "gb-sct" },
  Suiza: { code: "SUI", flag: "ch" },
  Eslovenia: { code: "SVN", flag: "si" },
  Eslovaquia: { code: "SVK", flag: "sk" },
  Kazajistán: { code: "KAZ", flag: "kz" },
  Islandia: { code: "ISL", flag: "is" },
  Luxemburgo: { code: "LUX", flag: "lu" },
  Bulgaria: { code: "BUL", flag: "bg" },
  Estonia: { code: "EST", flag: "ee" },
  Finlandia: { code: "FIN", flag: "fi" },
  Bielorrusia: { code: "BLR", flag: "by" },
  Moldavia: { code: "MDA", flag: "md" },
  "Islas Feroe": { code: "FRO", flag: "fo" },
  "San Marino": { code: "SMR", flag: "sm" },
  Albania: { code: "ALB", flag: "al" },
  Macedonia: { code: "MKD", flag: "mk" },
  Austria: { code: "AUT", flag: "at" },
  Kosovo: { code: "KOS", flag: "xk" },
  Israel: { code: "ISR", flag: "il" },
  Irlanda: { code: "IRL", flag: "ie" },
  Gales: { code: "WAL", flag: "gb-wls" },
  Noruega: { code: "NOR", flag: "no" },
  Grecia: { code: "GRE", flag: "gr" },
  Serbia: { code: "SRB", flag: "rs" },
  Dinamarca: { code: "DEN", flag: "dk" },
  Lituania: { code: "LTU", flag: "lt" },
  Azerbaiyán: { code: "AZE", flag: "az" },
  Gibraltar: { code: "GIB", flag: "gi" },
  Andorra: { code: "AND", flag: "ad" },
  Malta: { code: "MLT", flag: "mt" },
  Liechtenstein: { code: "LIE", flag: "li" },
  Ucrania: { code: "UKR", flag: "ua" },
  Letonia: { code: "LVA", flag: "lv" },
  Chipre: { code: "CYP", flag: "cy" },
  Armenia: { code: "ARM", flag: "am" },
  Montenegro: { code: "MNE", flag: "me" },
  Georgia: { code: "GEO", flag: "ge" },
  Brasil: { code: "BRA", flag: "br" },
  Argentina: { code: "ARG", flag: "ar" },
  "Estados Unidos": { code: "USA", flag: "us" },
};

export function teamMark(name: string): Mark | null {
  return MARKS[teamOfficial(name)] ?? null;
}

export function markImage(name: string, logo: string | null): { code: string; url: string; kind: "bandera" | "escudo" } | null {
  const mark = teamMark(name);
  if (!mark) return null;
  if (mark.flag) return { code: mark.code, url: `https://flagcdn.com/w320/${mark.flag}.png`, kind: "bandera" };
  if (logo?.startsWith("https://")) return { code: mark.code, url: logo, kind: "escudo" };
  return null;
}
