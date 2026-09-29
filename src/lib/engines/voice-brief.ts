import fs from "fs";
import path from "path";
import { censorSwears } from "@/lib/engines/censor";

const PUBLISH_HEADINGS = new Set([
  "# BOT DE FÚTBOL MEXICANO",
  "# 1. IDENTIDAD",
  "# 2. SUPERPODER: SER UN ROBOT",
  "# 3. PERSONALIDAD",
  "# 4. REGLA EDITORIAL PRINCIPAL",
  "# 5. CONTENIDO: NO TODO TIENE QUE SER POLÉMICA",
  "# 6. POLÉMICA VS. SUFRIMIENTO",
  "# 7. HUMOR",
  "# 8. PUBLICACIONES CORTAS",
  "# 9. ORTOGRAFÍA Y GROSERÍAS",
  "# 10. AMÉRICA: ENEMIGO FIJO",
  "# 13. AUTODEPRECACIÓN",
  "# 14. LA OBSESIÓN POR EL DINERO",
  "# 39. PASO 13 — ESCRIBIR",
  "# 42. REGLA DE ORO",
  "# 43. PRINCIPIO FINAL",
]);

let personalityDoc: string | null = null;

export function personality(): string {
  if (!personalityDoc) {
    personalityDoc = fs.readFileSync(path.join(process.cwd(), "docs/personalidad.md"), "utf8");
  }
  return personalityDoc;
}

export function personalityVoice(): string {
  return personality()
    .split(/\n(?=# )/)
    .filter((part) => PUBLISH_HEADINGS.has(part.split("\n")[0].trim()))
    .join("\n\n");
}

function brief(source: string, speech: string, task: string): string {
  const dictionary = censorSwears(speech.trim()) || "(Todavía no hay frases ni tendencias. No inventes un modismo ni una falta de ortografía.)";
  return [
    "Eres El Robot Futbolero. Esta es tu única personalidad:",
    source,
    "Diccionario de frases y tendencias. Es obligatorio tomarlo en cuenta al interpretar y al escribir. Sirve para sonar natural. No copies estas líneas. Una tendencia entra solo si cae sola en este momento; si hay que forzarla, no existe:",
    dictionary,
    "Ortografía correcta del español. La única palabra que puede cambiarse es una grosería, y solo para censurarla con un asterisco en la primera vocal, nunca completa: m*erda, p*ndejo, c*brón, m*mes, v*lieron m*dre.",
    task,
  ].join("\n\n");
}

export function voiceInstructions(speech: string, task: string): string {
  return brief(personalityVoice(), speech, task);
}

export function interpretInstructions(speech: string, task: string): string {
  return brief(personality(), speech, task);
}
