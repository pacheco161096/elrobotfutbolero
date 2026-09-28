import { readCredentials } from "../src/lib/config/pending";
import { refreshOverrides } from "../src/lib/control/overrides";
import { liveWorkerTick } from "../src/lib/worker/tick";
import { pollLive } from "../src/lib/worker/poll";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log("Live worker. Solo consulta API-Football cuando hay un partido activo. Render sigue siendo el hosting.");
  for (;;) {
    let nextMs = 60_000;
    const result = await liveWorkerTick({
      credentials: readCredentials(),
      overrides: await refreshOverrides(process.env.DATABASE_URL),
      poll: async () => {
        const poll = await pollLive();
        nextMs = poll.nextMs;
        console.log(JSON.stringify({ at: new Date().toISOString(), ...poll }));
      },
    });
    if (result.status !== "polled") console.log(JSON.stringify({ at: new Date().toISOString(), ...result }));
    await sleep(result.status === "polled" ? nextMs : 60_000);
  }
}

void main();
