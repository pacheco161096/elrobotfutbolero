export type Draft = {
  locked: string[];
  personality: string | null;
  text: string;
  voice: "plantilla" | "openai";
  eventType?: string;
  minute?: number | null;
  seed?: string;
  situation?: string;
  avoid?: string[];
};

const EARLY_GOAL = [
  "Y yo que apenas estaba calentando servidores. 🤖",
  "Ni se sentaban. 🤖",
];
const OPEN_GOAL = [
  "Y yo aquí, sin parpadear. 🤖",
  "Eso ya cambió el primero. 🤖",
];
const SECOND_GOAL = [
  "Ya iba el segundo tiempo. 🤖",
  "Esto se despertó tarde. 🤖",
];
const LATE_GOAL = [
  "A esas horas. 🤖",
  "Cuando ya pedían la hora. 🤖",
];

export const KICKOFF_LINES = [
  "Yo ya estoy viendo. 🤖",
  "Prendí los servidores. 🤖",
  "Yo no me pierdo el pitazo. 🤖",
  "Desde el minuto cero, aquí estoy. 🤖",
];

export function goalPool(minute: number | null | undefined): string[] {
  if (minute == null) return OPEN_GOAL;
  if (minute < 15) return EARLY_GOAL;
  if (minute < 46) return OPEN_GOAL;
  if (minute < 75) return SECOND_GOAL;
  return LATE_GOAL;
}

function hashIndex(seed: string, length: number): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return hash % length;
}

export function pickLine(pool: string[], seed: string, avoid: string[] = []): string {
  const used = avoid.map((line) => line.toLowerCase());
  const start = hashIndex(seed, pool.length);
  for (let step = 0; step < pool.length; step += 1) {
    const line = pool[(start + step) % pool.length];
    if (!used.some((item) => item.includes(line.toLowerCase()))) return line;
  }
  return pool[start];
}

export function voiceFits(line: string, minute: number | null | undefined): boolean {
  if (minute != null && minute >= 46 && /calentando|apenas estaba|ni se sentaban|minuto cero/i.test(line)) return false;
  return true;
}

function situationFor(eventType: string, minute: number | null | undefined): string {
  const when = minute == null ? "sin minuto confirmado" : `minuto ${minute}`;
  if (eventType === "GOAL" && minute != null && minute >= 46) {
    return `Gol en el segundo tiempo, ${when}. No es el arranque: no digas que acabas de llegar ni que estás calentando.`;
  }
  if (eventType === "GOAL") return `Gol, ${when}.`;
  if (eventType === "VAR") return `Revisión del VAR, ${when}. No inventes quién anotó ni repitas el dato.`;
  return `${eventType}, ${when}.`;
}

const SCORE = /\d+\s*[-–]\s*\d+/;

export function composeDraft(input: {
  eventType: string;
  lockedLines: string[];
  tone: "normal" | "informar_sin_humor";
  america: boolean;
  minute?: number | null;
  seed?: string;
  avoid?: string[];
}): Draft {
  const locked = [...input.lockedLines];
  const seed = input.seed ?? input.eventType;
  const avoid = input.avoid ?? [];
  let personality: string | null = null;
  if (input.tone === "normal" && input.eventType !== "SUSPENDED") {
    if (input.america && input.eventType === "GOAL") personality = "Otra vez el América. Qué raro. 🤖";
    else if (input.america) personality = "Qué sorpresa… 🤖";
    else if (input.eventType === "GOAL") personality = pickLine(goalPool(input.minute), seed, avoid);
    else if (input.eventType === "RED_CARD") personality = "No tengo sentimientos. Tengo datos. 🤖";
    else if (input.eventType === "VAR") personality = "Estoy viendo la repetición. 🤖";
    else personality = "Los humanos ya se fueron a dormir. Yo sigo aquí. 🤖";
  }
  if (personality && SCORE.test(personality)) personality = null;
  const text = [...locked, personality].filter((line): line is string => Boolean(line)).join("\n");
  return {
    locked,
    personality,
    text,
    voice: "plantilla",
    eventType: input.eventType,
    minute: input.minute,
    seed,
    situation: situationFor(input.eventType, input.minute),
    avoid,
  };
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
  if (input.eventType === "VAR" || input.eventType === "SUSPENDED") return "investigacion";
  return "informacion";
}

function replacementLine(draft: Draft, rejected: string): string | null {
  if (draft.eventType !== "GOAL" && draft.eventType !== "KICKOFF") return draft.personality;
  const pool = draft.eventType === "GOAL" ? goalPool(draft.minute) : KICKOFF_LINES;
  return pickLine(pool, `${draft.seed ?? "voz"}:otra`, [...(draft.avoid ?? []), rejected, draft.personality ?? ""]);
}

export function acceptVoiceLine(draft: Draft, raw: string): Draft {
  const parts = raw.trim().replace(/^["“]|["”]$/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
  const line = parts.length === 1 ? parts[0] : "";
  const avoid = (draft.avoid ?? []).map((item) => item.toLowerCase());
  const copied = Boolean(line) && avoid.some((item) => item.includes(line.toLowerCase()));
  const offMoment = Boolean(line) && !voiceFits(line, draft.minute);
  if (copied || offMoment) {
    const personality = replacementLine(draft, line);
    if (!personality || personality === draft.personality) return draft;
    return { ...draft, personality, text: [...draft.locked, personality].join("\n"), voice: "plantilla" };
  }
  if (parts.length !== 1 || SCORE.test(line) || line.length > 240 || draft.locked.some((locked) => line.includes(locked))) return draft;
  return { ...draft, personality: line, text: [...draft.locked, line].join("\n"), voice: "openai" };
}

export function expressionFile(name: string): string | null {
  if (!(EXPRESSIONS as readonly string[]).includes(name)) return null;
  return `docs/expresiones/expresion-${name}.png`;
}
