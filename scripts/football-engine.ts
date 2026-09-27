import { runFootballEngine } from "../src/lib/cron/run";

async function main(): Promise<void> {
  const result = await runFootballEngine();
  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Refresco: ${result.refreshed ? "sí" : "no"}. Guardados: ${result.saved}. Prepartido: ${result.preMatch}. Eventos revisados: ${result.checked}. Nuevos: ${result.stored}.`,
  );
}

void main();
