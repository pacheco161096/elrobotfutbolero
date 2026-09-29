import { imageUsd, recordAiUsage } from "@/lib/integrations/ai-cost";

const MODEL = "gpt-image-1-mini";

async function publicUrl(bytes: Buffer, fetchImpl: typeof fetch): Promise<string | null> {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "robot.png");
  try {
    const hosted = await fetchImpl("https://catbox.moe/user/api.php", { method: "POST", body: form });
    if (!hosted.ok) return null;
    const url = (await hosted.text()).trim();
    return url.startsWith("https://") ? url : null;
  } catch {
    return null;
  }
}

export async function generateRobotImage(
  expression: string,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
  scene = "watching a football match on a dark screen",
): Promise<string | null> {
  if (!env.OPENAI_API_KEY) return null;
  let response: Response;
  try {
    response = await fetchImpl("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        size: "1024x1024",
        prompt: `Simple modern robot, square head, LED eyes, green, internet-native, not childish, not a humanoid, no football jersey, no club crest, no brand logos, no real players, no copied photograph, no text. Expression: ${expression}. Scene: ${scene}. Dark background.`,
      }),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const direct = body.data?.[0]?.url;
  if (direct?.startsWith("https://")) {
    await recordAiUsage({ area: "imagen", model: MODEL, promptTokens: 0, completionTokens: 0, usd: imageUsd(MODEL) }, env);
    return direct;
  }
  const encoded = body.data?.[0]?.b64_json;
  if (!encoded) return null;
  const image = await publicUrl(Buffer.from(encoded, "base64"), fetchImpl);
  if (!image) return null;
  await recordAiUsage({ area: "imagen", model: MODEL, promptTokens: 0, completionTokens: 0, usd: imageUsd(MODEL) }, env);
  return image;
}
