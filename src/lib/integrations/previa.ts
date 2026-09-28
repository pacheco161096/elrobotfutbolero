import type { Draft } from "@/lib/engines/copy";

const SCORE = /\d+\s*[-–]\s*\d+/;

export function previaDraft(input: { home: string; away: string; kickoff: Date }): Draft {
  const hour = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(input.kickoff);
  const locked = [`Hoy juegan ${input.home} y ${input.away}.`, `El pitazo es a las ${hour}.`];
  const personality = "Yo ya estoy prendido.";
  const text = [...locked, personality].join("\n");
  if (SCORE.test(text)) {
    return { locked: [`Hoy juegan ${input.home} y ${input.away}.`], personality, text: `Hoy juegan ${input.home} y ${input.away}.\n${personality}`, voice: "plantilla" };
  }
  return { locked, personality, text, voice: "plantilla" };
}
