import type { Credentials } from "@/lib/config/pending";

export type Gate =
  | { status: "pending_credentials"; missing: string[] }
  | { status: "ready" };

function missing(flags: Array<[boolean, string]>): string[] {
  return flags.filter(([ready]) => !ready).map(([, name]) => name);
}

export function zernioGate(env: Record<string, string | undefined> = process.env): Gate {
  const pending = missing([
    [Boolean(env.ZERNIO_API_KEY), "ZERNIO_API_KEY"],
    [Boolean(env.ZERNIO_BASE_URL), "ZERNIO_BASE_URL"],
    [Boolean(env.ZERNIO_PUBLISH_PATH), "ZERNIO_PUBLISH_PATH"],
  ]);
  return pending.length ? { status: "pending_credentials", missing: pending } : { status: "ready" };
}

export async function publishWithZernio(
  input: { idempotencyKey: string; text: string },
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Gate | { status: "sent"; externalId: string | null }> {
  const gate = zernioGate(env);
  if (gate.status === "pending_credentials") return gate;
  const response = await fetchImpl(new URL(env.ZERNIO_PUBLISH_PATH as string, env.ZERNIO_BASE_URL), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.ZERNIO_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({ text: input.text, network: "facebook" }),
  });
  const body = (await response.json().catch(() => ({}))) as { id?: string };
  return { status: "sent", externalId: body.id ?? null };
}

export function brightDataGate(env: Record<string, string | undefined> = process.env): Gate {
  if (!env.BRIGHT_DATA_API_KEY) return { status: "pending_credentials", missing: ["BRIGHT_DATA_API_KEY"] };
  return { status: "ready" };
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
