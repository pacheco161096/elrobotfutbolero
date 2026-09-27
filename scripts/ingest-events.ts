import { ingestPlayedEvents } from "../src/lib/integrations/ingest-events";

async function main(): Promise<void> {
  const result = await ingestPlayedEvents();
  console.log(`Partidos revisados: ${result.checked}. Eventos nuevos: ${result.stored}.`);
}

void main();
