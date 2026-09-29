import { runSpeech } from "../src/lib/integrations/speech-collect";

async function main(): Promise<void> {
  const result = await runSpeech(process.env, new Date(), fetch, "start");
  console.log(JSON.stringify(result));
  if (result.status === "error") process.exitCode = 1;
}

void main();
