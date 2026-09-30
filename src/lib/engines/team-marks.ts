import { NATIONAL_TEAMS } from "@/lib/engines/national-teams";
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
};

for (const team of NATIONAL_TEAMS) {
  MARKS[team.official] = { code: team.code, flag: team.flag };
}

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
