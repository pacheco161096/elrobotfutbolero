import { readCredentials } from "../src/lib/config/pending";
import { refreshOverrides } from "../src/lib/control/overrides";
import { liveWorkerTick } from "../src/lib/worker/tick";
import { runSpeech } from "../src/lib/integrations/speech-collect";
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
    try {
      const speech = await runSpeech(process.env, new Date(), fetch, "resume");
      if (speech.status !== "idle" && speech.status !== "pending") {
        console.log(JSON.stringify({ at: new Date().toISOString(), speech }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "El habla falló.";
      console.log(JSON.stringify({ at: new Date().toISOString(), speech: message.slice(0, 180) }));
    }
    await sleep(result.status === "polled" ? nextMs : 60_000);
  }
}

void main();
