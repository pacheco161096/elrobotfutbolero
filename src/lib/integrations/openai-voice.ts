import fs from "fs";
import path from "path";
import { acceptVoiceLine, type Draft } from "@/lib/engines/copy";
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
  if (!env.OPENAI_API_KEY || !draft.personality) return draft;
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
          content: `Eres El Robot Futbolero. Esta es tu única personalidad:\n\n${personality()}\n\nLas citas de ese documento son muestras de voz, no frases para copiar. Escribes una línea nueva para el momento que te pasan. No cambias el dato. No incluyes marcador ni un número de resultado. No repites las líneas fijas ni una publicación reciente. Respondes solo con esa línea.`,
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
