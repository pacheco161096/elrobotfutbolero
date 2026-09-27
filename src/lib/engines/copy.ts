export type Draft = {
  locked: string[];
  personality: string | null;
  text: string;
  voice: "plantilla" | "openai";
};

const SCORE = /\d+\s*[-–]\s*\d+/;

export function composeDraft(input: {
  eventType: string;
  lockedLines: string[];
  tone: "normal" | "informar_sin_humor";
  america: boolean;
}): Draft {
  const locked = [...input.lockedLines];
  let personality: string | null = null;
  if (input.tone === "normal" && input.eventType !== "SUSPENDED") {
    if (input.america) personality = "Qué sorpresa… 🤖";
    else if (input.eventType === "GOAL") personality = "Y yo que apenas estaba calentando servidores. 🤖";
    else if (input.eventType === "RED_CARD") personality = "No tengo sentimientos. Tengo datos. 🤖";
    else personality = "Los humanos ya se fueron a dormir. Yo sigo aquí. 🤖";
  }
  if (personality && SCORE.test(personality)) personality = null;
  const text = [...locked, personality].filter((line): line is string => Boolean(line)).join("\n");
  return { locked, personality, text, voice: "plantilla" };
}

const EXPRESSIONS = [
  "informacion",
  "sospecha",
  "humor",
  "derrota",
  "polemica",
  "golazo",
  "ego",
  "investigacion",
  "dinero",
  "ambicion",
] as const;

export type ExpressionName = (typeof EXPRESSIONS)[number];

export function pickExpression(input: { eventType: string; tone: "normal" | "informar_sin_humor"; meme?: boolean }): ExpressionName {
  if (input.tone === "informar_sin_humor") return "informacion";
  if (input.meme) return "humor";
  if (input.eventType === "GOAL") return "golazo";
  if (input.eventType === "RED_CARD" || input.eventType === "PENALTY" || input.eventType === "COMPLAINT") return "polemica";
  if (input.eventType === "SUSPENDED") return "investigacion";
  return "informacion";
}

export function acceptVoiceLine(draft: Draft, raw: string): Draft {
  const parts = raw.trim().replace(/^["“]|["”]$/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (parts.length !== 1) return draft;
  const personality = parts[0];
  if (SCORE.test(personality) || personality.length > 240) return draft;
  if (draft.locked.some((line) => personality.includes(line))) return draft;
  return { ...draft, personality, text: [...draft.locked, personality].join("\n"), voice: "openai" };
}

export function expressionFile(name: string): string | null {
  if (!(EXPRESSIONS as readonly string[]).includes(name)) return null;
  return `docs/expresiones/expresion-${name}.png`;
}
