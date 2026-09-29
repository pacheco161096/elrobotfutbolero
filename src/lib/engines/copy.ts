import { censorSwears } from "@/lib/engines/censor";

export type Draft = {
  locked: string[];
  personality: string | null;
  text: string;
  voice: "plantilla" | "openai";
  eventType?: string;
  minute?: number | null;
  detail?: string | null;
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

export type MatchClock = "sin_minuto" | "primero" | "segundo" | "compensacion";
export type GoalKind = "gol" | "autogol" | "penal";

export function matchClock(minute: number | null | undefined): MatchClock {
  if (minute == null) return "sin_minuto";
  if (minute >= 90) return "compensacion";
  if (minute >= 46) return "segundo";
  return "primero";
}

export function goalKind(detail: string | null | undefined): GoalKind {
  const text = (detail ?? "").toLowerCase();
  if (text.includes("own")) return "autogol";
  if (text.includes("penalty") || text.includes("penal")) return "penal";
  return "gol";
}

export function goalPool(minute: number | null | undefined, kind: GoalKind = "gol"): string[] {
  const clock = matchClock(minute);
  if (kind === "autogol") {
    return clock === "primero"
      ? ["Se lo metió solo. 🤖", "En propia, y apenas iba. 🤖"]
      : ["Se lo metió solo, a esas horas. 🤖", "En propia, ya iba tarde. 🤖"];
  }
  if (kind === "penal") {
    return clock === "compensacion" || clock === "segundo"
      ? ["Les dejaron el penal a esas horas. 🤖", "El penal les cayó cuando ya pedían la hora. 🤖"]
      : ["Les dejaron el penal. 🤖", "Ni se sentaban y ya hay penal. 🤖"];
  }
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

const CLOCK_LABEL: Record<MatchClock, string> = {
  sin_minuto: "sin minuto confirmado",
  primero: "primer tiempo",
  segundo: "segundo tiempo",
  compensacion: "tiempo de compensación",
};

export function describeMoment(input: { eventType: string; minute?: number | null; detail?: string | null }): string {
  const clock = matchClock(input.minute);
  const when = input.minute == null ? CLOCK_LABEL[clock] : `${CLOCK_LABEL[clock]}, minuto ${input.minute}`;
  const kind = goalKind(input.detail);
  if (input.eventType === "GOAL" && kind === "autogol") {
    return `Autogol, ${when}. El jugador se lo metió en propia. No lo trates como un golazo del equipo que lo sufrió, ni como si el partido acabara de empezar.`;
  }
  if (input.eventType === "GOAL" && kind === "penal") {
    return `Gol de penal, ${when}. El dato ya dice que fue penal. La frase habla de ese momento, no del arranque.`;
  }
  if (input.eventType === "GOAL" && clock !== "primero" && clock !== "sin_minuto") {
    return `Gol, ${when}. No es el arranque: no digas que acabas de llegar ni que estás calentando.`;
  }
  if (input.eventType === "GOAL") return `Gol, ${when}.`;
  const detail = (input.detail ?? "").toLowerCase();
  if (input.eventType === "VAR" && (detail.includes("confirmed") || detail.includes("confirm"))) {
    return `El VAR ya decidió, ${when}. No digas que sigue revisando. No nombres a un jugador que no esté en las líneas fijas.`;
  }
  if (input.eventType === "VAR") return `El VAR revisa la jugada, ${when}. No inventes el fallo ni quién anotó.`;
  return `${input.eventType}, ${when}.`;
}

const SCORE = /\d+\s*[-–]\s*\d+/;

export function composeDraft(input: {
  eventType: string;
  lockedLines: string[];
  tone: "normal" | "informar_sin_humor";
  america: boolean;
  minute?: number | null;
  detail?: string | null;
  seed?: string;
  avoid?: string[];
}): Draft {
  const locked = [...input.lockedLines];
  const seed = input.seed ?? input.eventType;
  const avoid = input.avoid ?? [];
  let personality: string | null = null;
  if (input.tone === "normal" && input.eventType !== "SUSPENDED") {
    if (input.america && input.eventType === "GOAL" && goalKind(input.detail) === "gol") personality = "Otra vez el América. Qué raro. 🤖";
    else if (input.america) personality = "Qué sorpresa… 🤖";
    else if (input.eventType === "GOAL") personality = pickLine(goalPool(input.minute, goalKind(input.detail)), seed, avoid);
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
    detail: input.detail,
    seed,
    situation: describeMoment({ eventType: input.eventType, minute: input.minute, detail: input.detail }),
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

function repeatsLocked(line: string, locked: string[]): boolean {
  const spoken = line.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return locked.some((item) => {
    if (line.includes(item)) return true;
    const words = item.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(" ").filter((word) => word.length >= 2);
    for (let index = 0; index <= words.length - 4; index += 1) {
      const window = words.slice(index, index + 4).join(" ");
      if (window.length >= 12 && spoken.includes(window)) return true;
    }
    return false;
  });
}

export function acceptVoiceLine(draft: Draft, raw: string): Draft {
  const parts = censorSwears(raw).trim().replace(/^["“]|["”]$/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
  const line = parts.length === 1 ? parts[0] : "";
  const avoid = (draft.avoid ?? []).map((item) => item.toLowerCase());
  const copied = Boolean(line) && avoid.some((item) => item.includes(line.toLowerCase()));
  const offMoment = Boolean(line) && !voiceFits(line, draft.minute);
  const rejected = !line || copied || offMoment || parts.length !== 1 || SCORE.test(line) || line.length > 240 || repeatsLocked(line, draft.locked);
  if (rejected) return { ...draft, personality: null, text: draft.locked.join("\n"), voice: "plantilla" };
  return { ...draft, personality: line, text: [...draft.locked, line].join("\n"), voice: "openai" };
}

export function expressionFile(name: string): string | null {
  if (!(EXPRESSIONS as readonly string[]).includes(name)) return null;
  return `docs/expresiones/expresion-${name}.png`;
}
