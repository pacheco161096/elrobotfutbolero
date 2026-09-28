import { syncStandings } from "../src/lib/integrations/sync-matches";

async function main(): Promise<void> {
  const table = await syncStandings();
  if (table.error) {
    console.error(table.error);
    process.exitCode = 1;
    return;
  }
  console.log(`Filas de tabla guardadas: ${table.saved}.`);
}

void main();
