import { syncLigaMx, syncStandings } from "../src/lib/integrations/sync-matches";

async function main(): Promise<void> {
  const result = await syncLigaMx();
  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }
  console.log(`Partidos guardados: ${result.saved}. Ventana ${result.window.from} a ${result.window.to}.`);
  const table = await syncStandings();
  if (table.error) {
    console.error(table.error);
    process.exitCode = 1;
    return;
  }
  console.log(`Filas de tabla guardadas: ${table.saved}.`);
}

void main();
