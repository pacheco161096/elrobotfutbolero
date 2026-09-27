import { workerGate } from "@/lib/integrations/gates";
import type { Credentials } from "@/lib/config/pending";
import type { Overrides } from "@/lib/control/overrides";

export async function liveWorkerTick(input: {
  credentials: Pick<Credentials, "database" | "apiFootball">;
  overrides: Overrides;
  poll: () => Promise<void>;
}): Promise<{ status: "paused" | "pending_credentials" | "polled"; missing: string[] }> {
  if (input.overrides.pauseAll || input.overrides.pauseLive) {
    return { status: "paused", missing: [] };
  }
  const gate = workerGate(input.credentials);
  if (gate.status === "pending_credentials") {
    return { status: "pending_credentials", missing: gate.missing };
  }
  await input.poll();
  return { status: "polled", missing: [] };
}
