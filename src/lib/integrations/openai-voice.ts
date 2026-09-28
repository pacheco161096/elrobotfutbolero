import fs from "fs";
import path from "path";
import { acceptVoiceLine, type Draft } from "@/lib/engines/copy";
import { acceptMomentLine } from "@/lib/engines/match-pulse";
import { acceptPageLine } from "@/lib/engines/page-voice";
import { estimateUsd, recordAiUsage } from "@/lib/integrations/ai-cost";

let personalityDoc: string | null = null;

function personality(): string {
  if (!personalityDoc) {
    personalityDoc = fs.readFileSync(path.join(process.cwd(), "docs/personalidad.md"), "utf8");
  }
  return personalityDoc;
}

export async function applyVoice(
  draft: Draft,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Draft> {
  if (!env.OPENAI_API_KEY || (!draft.personality && !draft.situation && draft.locked.length === 0)) return draft;
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `Eres El Robot Futbolero. Esta es tu única personalidad:\n\n${personality()}\n\nLas citas de ese documento son muestras de voz, no frases para copiar. Escribes una línea nueva para el momento que te pasan. No cambias el dato. No incluyes marcador ni un número de resultado. Si nombras un equipo, usa el nombre en español que ya viene en el momento. En México el apodo va primero. No uses el nombre en inglés. No repites las líneas fijas ni una publicación reciente. Respondes solo con esa línea.`,
        },
        {
          role: "user",
          content: `Momento:\n${draft.situation ?? "Un dato del partido."}\n\nLíneas fijas, no las toques:\n${draft.locked.join("\n")}\n\nNo repitas estas publicaciones:\n${(draft.avoid ?? []).slice(0, 6).join("\n") || "(ninguna)"}\n\nDevuelve solo la línea de personalidad.`,
        },
      ],
    }),
  });
  if (!response.ok) return draft;
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  const promptTokens = body.usage?.prompt_tokens ?? 0;
  const completionTokens = body.usage?.completion_tokens ?? 0;
  if (promptTokens || completionTokens) {
    await recordAiUsage({ area: "voz", model, promptTokens, completionTokens, usd: estimateUsd(model, promptTokens, completionTokens) }, env);
  }
  const content = body.choices?.[0]?.message?.content;
  if (!content) return draft;
  return acceptVoiceLine(draft, content);
}

export async function reinterpretPage(
  input: { source: string; author: string; situation: string },
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!env.OPENAI_API_KEY || !input.source.trim()) return null;
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `Eres El Robot Futbolero. Esta es tu única personalidad:\n\n${personality()}\n\nUna página ajena te pasó material. No es un dato confirmado. No copies el titular. No nombres la página ni uses su firma. No incluyas marcador. Si no hay un ángulo propio, respondes NADA. Si lo hay, respondes solo con una línea nueva.`,
        },
        {
          role: "user",
          content: `Momento:\n${input.situation}\n\nTexto ajeno, no lo publiques:\n${input.source.slice(0, 500)}\n\nLa página se llama ${input.author}. Ese nombre no sale.`,
        },
      ],
    }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  const promptTokens = body.usage?.prompt_tokens ?? 0;
  const completionTokens = body.usage?.completion_tokens ?? 0;
  if (promptTokens || completionTokens) {
    await recordAiUsage({ area: "voz", model, promptTokens, completionTokens, usd: estimateUsd(model, promptTokens, completionTokens) }, env);
  }
  return acceptPageLine(input.source, input.author, body.choices?.[0]?.message?.content ?? "");
}

export async function writeMomentLine(
  input: { situation: string; avoid: string[]; minute: number | null },
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ spoke: boolean; line: string | null }> {
  if (!env.OPENAI_API_KEY || !input.situation.trim()) return { spoke: false, line: null };
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `Eres El Robot Futbolero. Esta es tu única personalidad:\n\n${personality()}\n\nLas citas de ese documento son muestras de voz, no frases para copiar. Escribes una línea nueva para este partido y este minuto. No incluyas marcador, porcentajes ni ninguna cifra. Si nombras un equipo, usa el nombre en español del momento. En México el apodo va primero. No uses el nombre en inglés. No repitas una publicación reciente. Si la lectura no da para una línea, respondes NADA.`,
        },
        {
          role: "user",
          content: `${input.situation}\n\nNo repitas estas publicaciones:\n${input.avoid.slice(0, 8).join("\n") || "(ninguna)"}`,
        },
      ],
    }),
  });
  if (!response.ok) return { spoke: false, line: null };
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  const promptTokens = body.usage?.prompt_tokens ?? 0;
  const completionTokens = body.usage?.completion_tokens ?? 0;
  if (promptTokens || completionTokens) {
    await recordAiUsage({ area: "voz", model, promptTokens, completionTokens, usd: estimateUsd(model, promptTokens, completionTokens) }, env);
  }
  return { spoke: true, line: acceptMomentLine(body.choices?.[0]?.message?.content ?? "", input.avoid, input.minute) };
}
