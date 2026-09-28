import { imageUsd, recordAiUsage } from "@/lib/integrations/ai-cost";

const MODEL = "dall-e-3";

export async function generateRobotImage(
  expression: string,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!env.OPENAI_API_KEY) return null;
  const response = await fetchImpl("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      size: "1024x1024",
      response_format: "url",
      prompt: `Simple modern robot, square head, expressive, internet-native, not childish, not a humanoid, no football jersey, no club crest, no brand logos. Expression: ${expression}. Dark plain background.`,
    }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: Array<{ url?: string }> };
  const url = body.data?.[0]?.url;
  const image = url?.startsWith("https://") ? url : null;
  await recordAiUsage({ area: "imagen", model: MODEL, promptTokens: 0, completionTokens: 0, usd: imageUsd(MODEL) }, env);
  return image;
}
