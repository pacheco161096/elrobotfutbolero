import type { Credentials } from "@/lib/config/pending";
import { brightDataMissing } from "@/lib/integrations/bright-data";

export type Gate =
  | { status: "pending_credentials"; missing: string[] }
  | { status: "ready" };

function missing(flags: Array<[boolean, string]>): string[] {
  return flags.filter(([ready]) => !ready).map(([, name]) => name);
}

const ZERNIO_POSTS = "https://zernio.com/api/v1/posts";

/** Fondo negro sólido de Facebook (texto blanco). El morado 106018623298955 no se usa. */
export const FACEBOOK_BLACK_TEXT_PRESET = "1881421442117417";

export function zernioMissing(env: Record<string, string | undefined>): string[] {
  return missing([
    [Boolean(env.ZERNIO_API_KEY), "ZERNIO_API_KEY"],
    [Boolean(env.ZERNIO_ACCOUNT_ID), "ZERNIO_ACCOUNT_ID"],
  ]);
}

export function zernioGate(env: Record<string, string | undefined> = process.env): Gate {
  const pending = zernioMissing(env);
  return pending.length ? { status: "pending_credentials", missing: pending } : { status: "ready" };
}

export function zernioPostBody(input: {
  text: string;
  accountId: string;
  imageUrl?: string | null;
  textPresetId?: string | null;
}): { content: string; publishNow: true; mediaItems?: Array<{ type: "image"; url: string }>; platforms: Array<Record<string, unknown>> } {
  const image = input.imageUrl?.startsWith("https://") ? input.imageUrl : null;
  const preset = !image && input.textPresetId && /^\d+$/.test(input.textPresetId) ? input.textPresetId : null;
  const platform: Record<string, unknown> = { platform: "facebook", accountId: input.accountId };
  if (preset) platform.platformSpecificData = { facebookSettings: { textFormatPresetId: preset } };
  return {
    content: input.text,
    publishNow: true,
    ...(image ? { mediaItems: [{ type: "image" as const, url: image }] } : {}),
    platforms: [platform],
  };
}

export async function publishWithZernio(
  input: { idempotencyKey: string; text: string; imageUrl?: string | null },
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Gate | { status: "sent"; externalId: string | null } | { status: "error"; message: string }> {
  const gate = zernioGate(env);
  if (gate.status === "pending_credentials") return gate;
  const response = await fetchImpl(ZERNIO_POSTS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.ZERNIO_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": encodeURIComponent(input.idempotencyKey),
    },
    body: JSON.stringify(zernioPostBody({
      text: input.text,
      accountId: env.ZERNIO_ACCOUNT_ID as string,
      imageUrl: input.imageUrl,
      textPresetId: FACEBOOK_BLACK_TEXT_PRESET,
    })),
  });
  const body = (await response.json().catch(() => null)) as { post?: { _id?: string } } | null;
  if (!response.ok) return { status: "error", message: `Zernio no publicó (${response.status}).` };
  return { status: "sent", externalId: body?.post?._id ?? null };
}

export function brightDataGate(env: Record<string, string | undefined> = process.env): Gate {
  const pending = brightDataMissing(env);
  return pending.length ? { status: "pending_credentials", missing: pending } : { status: "ready" };
}

export function apiFootballGate(env: Record<string, string | undefined> = process.env): Gate {
  if (!env.API_FOOTBALL_KEY) return { status: "pending_credentials", missing: ["API_FOOTBALL_KEY"] };
  return { status: "ready" };
}

export function workerGate(credentials: Pick<Credentials, "database" | "apiFootball">): Gate {
  const pending = missing([
    [credentials.database, "DATABASE_URL"],
    [credentials.apiFootball, "API_FOOTBALL_KEY"],
  ]);
  return pending.length ? { status: "pending_credentials", missing: pending } : { status: "ready" };
}
