import { KICKOFF_LINES, pickLine, type Draft } from "@/lib/engines/copy";
import { teamSpoken } from "@/lib/engines/team-names";

const SCORE = /\d+\s*[-–]\s*\d+/;

export function kickoffDraft(input: { home: string; away: string; seed?: string; avoid?: string[] }): Draft {
  const seed = input.seed ?? `${input.home}:${input.away}`;
  const home = teamSpoken(input.home, `${seed}:home`);
  const away = teamSpoken(input.away, `${seed}:away`);
  const locked = [`Ya empezó ${home} contra ${away}.`];
  const personality = pickLine(KICKOFF_LINES, input.seed ?? `${input.home}:${input.away}`, input.avoid ?? []);
  return {
    locked,
    personality,
    text: [...locked, personality].join("\n"),
    voice: "plantilla",
    eventType: "KICKOFF",
    seed,
    situation: `El partido acaba de empezar: ${home} contra ${away}. Es el pitazo, no un gol. Nómbralos así, en español. No repitas el pitazo anterior.`,
    avoid: input.avoid ?? [],
  };
}

export function previaDraft(input: { home: string; away: string; kickoff: Date }): Draft {
  const hour = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(input.kickoff);
  const home = teamSpoken(input.home, `${input.home}:previa`);
  const away = teamSpoken(input.away, `${input.away}:previa`);
  const locked = [`Hoy juegan ${home} y ${away}.`, `El pitazo es a las ${hour}.`];
  const personality = "Yo ya estoy prendido.";
  const text = [...locked, personality].join("\n");
  if (SCORE.test(text)) {
    return { locked: [`Hoy juegan ${home} y ${away}.`], personality, text: `Hoy juegan ${home} y ${away}.\n${personality}`, voice: "plantilla" };
  }
  return {
    locked,
    personality,
    text,
    voice: "plantilla",
    situation: `Previa de ${home} contra ${away}. El horario ya está en las líneas fijas. Nómbralos así, en español.`,
  };
}
