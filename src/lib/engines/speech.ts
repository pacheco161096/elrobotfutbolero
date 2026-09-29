import { censorSwears } from "@/lib/engines/censor";
import { copiesPage } from "@/lib/engines/page-voice";

export type SpeechKind = "frase" | "tendencia" | "visual";

export type SpeechNote = {
  kind: SpeechKind;
  body: string;
  fingerprint: string;
  expiresAt: string;
};

const SCORE = /\d+\s*[-–]\s*\d+/;
const KINDS: SpeechKind[] = ["frase", "tendencia", "visual"];
const LIMITS: Record<SpeechKind, number> = { frase: 4, tendencia: 2, visual: 1 };
const KEEP: Record<SpeechKind, number> = { frase: 8, tendencia: 4, visual: 2 };

export const SPEECH_TTL_MS: Record<SpeechKind, number> = {
  frase: 36 * 60 * 60 * 1000,
  tendencia: 18 * 60 * 60 * 1000,
  visual: 18 * 60 * 60 * 1000,
};

export const SPEECH_DUE_MS = 4 * 60 * 60 * 1000;
export const SPEECH_STALE_MS = 45 * 60 * 1000;

export function speechKeep(kind: SpeechKind): number {
  return KEEP[kind];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function speechFingerprint(kind: SpeechKind, body: string): string {
  return `${kind}:${normalize(body).slice(0, 180)}`;
}

const PAGE_MARKS = [
  "michoacaneando",
  "generalisimo",
  "papi2748",
  "iachisachis",
  "pendejx",
  "fucxbox",
  "mepxge",
  "chuyin",
  "classroomemes",
  "puroshuapang",
  "centennialsenaprieto",
  "loquenodigoenpersona",
  "elclubdelosex",
  "joaquindlm",
];

export function acceptSpokenLine(raw: string): string | null {
  const body = censorSwears(raw.replace(/\s+/g, " ").trim());
  if (body.length < 20 || body.length > 160) return null;
  if (/[[\]{}<>|\\]/.test(body) || /https?:|@/i.test(body)) return null;
  const letters = body.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 12 || letters / body.length < 0.6) return null;
  const words = body.split(" ").map((word) => word.replace(/[^\p{L}*]/gu, "")).filter((word) => word.length >= 2);
  if (words.length < 5 || words.some((word) => word.length > 16)) return null;
  const flat = body.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (PAGE_MARKS.some((mark) => flat.includes(mark))) return null;
  return body;
}

function repeatsSource(body: string, sources: string[]): boolean {
  const spoken = normalize(body);
  return sources.some((source) => copiesPage(body, source) || normalize(source).includes(spoken));
}

function readBundle(raw: string): Record<SpeechKind, string[]> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return { frase: [], tendencia: [], visual: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { frase: [], tendencia: [], visual: [] };
  }
  if (!parsed || typeof parsed !== "object") return { frase: [], tendencia: [], visual: [] };
  const record = parsed as Record<string, unknown>;
  return {
    frase: stringsOf(record.frases),
    tendencia: stringsOf(record.tendencias),
    visual: stringsOf(record.visual),
  };
}

function stringsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function acceptSpeechBundle(raw: string, sources: string[], now: Date): SpeechNote[] {
  const bundle = readBundle(raw);
  const notes: SpeechNote[] = [];
  const seen = new Set<string>();
  for (const kind of KINDS) {
    for (const item of bundle[kind]) {
      const heard = item.trim().replace(/^["“]|["”]$/g, "").replace(/\s+/g, " ");
      if (heard.includes("\n") || SCORE.test(heard) || repeatsSource(heard, sources)) continue;
      const body = acceptSpokenLine(heard);
      if (!body) continue;
      const fingerprint = speechFingerprint(kind, body);
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      notes.push({
        kind,
        body,
        fingerprint,
        expiresAt: new Date(now.getTime() + SPEECH_TTL_MS[kind]).toISOString(),
      });
      if (notes.filter((note) => note.kind === kind).length >= LIMITS[kind]) break;
    }
  }
  return notes;
}

export function speechPromptBlock(notes: Array<{ kind: SpeechKind; body: string }>): string {
  const frases = notes.filter((note) => note.kind === "frase").map((note) => acceptSpokenLine(note.body)).filter((line): line is string => Boolean(line));
  const tendencias = notes.filter((note) => note.kind === "tendencia").map((note) => acceptSpokenLine(note.body)).filter((line): line is string => Boolean(line));
  const lines: string[] = [];
  if (frases.length) lines.push("Cómo se habla:", ...frases.map((line) => `- ${line}`));
  if (tendencias.length) lines.push("Tendencia, solo si cae sola:", ...tendencias.map((line) => `- ${line}`));
  return lines.join("\n");
}

export function speechDue(finishedAt: string | null, status: string | null, now: Date): boolean {
  if (status === "failed" || !finishedAt) return true;
  return now.getTime() - new Date(finishedAt).getTime() >= SPEECH_DUE_MS;
}

export function speechStale(startedAt: string, now: Date): boolean {
  return now.getTime() - new Date(startedAt).getTime() >= SPEECH_STALE_MS;
}

export function speechAction(input: {
  mode: "start" | "resume";
  status: "running" | "done" | "failed" | null;
  startedAt: string | null;
  finishedAt: string | null;
  now: Date;
}): "poll" | "trigger" | "idle" | "expire" {
  if (input.status === "running") {
    if (input.startedAt && speechStale(input.startedAt, input.now)) return "expire";
    return "poll";
  }
  if (input.mode === "resume") return "idle";
  if (speechDue(input.finishedAt, input.status, input.now)) return "trigger";
  return "idle";
}
