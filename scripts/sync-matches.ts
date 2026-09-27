import { syncLigaMx } from "../src/lib/integrations/sync-matches";

async function main(): Promise<void> {
  const result = await syncLigaMx();
  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }
  console.log(`Partidos guardados: ${result.saved}. Ventana ${result.window.from} a ${result.window.to}.`);
}

void main();
