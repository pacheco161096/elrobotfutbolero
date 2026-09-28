import { brightDataMissing } from "@/lib/integrations/bright-data";

export type PendingItem = {
  id: string;
  name: string;
  kind: "credential" | "infra";
  ready: boolean;
  detail: string;
};

export type Credentials = {
  database: boolean;
  apiFootball: boolean;
  openai: boolean;
  zernio: boolean;
  brightData: boolean;
  cron: boolean;
};

type Env = Record<string, string | undefined>;

export function readCredentials(env: Env = process.env): Credentials {
  return {
    database: Boolean(env.DATABASE_URL),
    apiFootball: Boolean(env.API_FOOTBALL_KEY),
    openai: Boolean(env.OPENAI_API_KEY),
    zernio: Boolean(env.ZERNIO_API_KEY && env.ZERNIO_ACCOUNT_ID),
    brightData: brightDataMissing(env).length === 0,
    cron: Boolean(env.CRON_SECRET),
  };
}

export function pendingItems(env: Env = process.env): PendingItem[] {
  const credentials = readCredentials(env);
  return [
    {
      id: "database",
      name: "PostgreSQL",
      kind: "credential",
      ready: credentials.database,
      detail: "DATABASE_URL. PostgreSQL vive en Vercel, junto con el sitio y /admin. No es Supabase.",
    },
    {
      id: "apiFootball",
      name: "API-Football",
      kind: "credential",
      ready: credentials.apiFootball,
      detail: "API_FOOTBALL_KEY. Partidos, marcador y eventos.",
    },
    {
      id: "openai",
      name: "OpenAI",
      kind: "credential",
      ready: credentials.openai,
      detail: "OPENAI_API_KEY. La voz sale de docs/personalidad.md. No cambia el dato.",
    },
    {
      id: "zernio",
      name: "Zernio → Facebook",
      kind: "credential",
      ready: credentials.zernio,
      detail: "ZERNIO_API_KEY y ZERNIO_ACCOUNT_ID. Publica en Facebook la pieza ya armada. El Flash va sin imagen, con el fondo negro de texto grande.",
    },
    {
      id: "brightData",
      name: "Bright Data",
      kind: "credential",
      ready: credentials.brightData,
      detail: "BRIGHT_DATA_API_KEY, BRIGHT_DATA_DATASET_ID y BRIGHT_DATA_PAGE_URLS. Varias fanpages en una sola llamada, máximo 20. Solo contexto social. El Flash no lo espera.",
    },
    {
      id: "cron",
      name: "Secreto de cron",
      kind: "credential",
      ready: credentials.cron,
      detail: "CRON_SECRET. cron-job.org lo envía como Bearer al disparar las tres rutas. El sondeo de 15 segundos no va ahí.",
    },
    {
      id: "vercel",
      name: "Vercel",
      kind: "infra",
      ready: env.VERCEL === "1",
      detail: "Sitio, /admin, API, cron, webhooks y PostgreSQL. El polling de 15 segundos no va aquí.",
    },
    {
      id: "render",
      name: "Render Background Worker",
      kind: "infra",
      ready: env.RENDER === "true",
      detail: "Polling en vivo. Entrada: worker/index.ts.",
    },
  ];
}

export function missingNames(credentials: Credentials, keys: Array<keyof Credentials>): string[] {
  const labels: Record<keyof Credentials, string> = {
    database: "DATABASE_URL",
    apiFootball: "API_FOOTBALL_KEY",
    openai: "OPENAI_API_KEY",
    zernio: "ZERNIO_API_KEY + ZERNIO_ACCOUNT_ID",
    brightData: "BRIGHT_DATA_API_KEY + BRIGHT_DATA_DATASET_ID + BRIGHT_DATA_PAGE_URLS",
    cron: "CRON_SECRET",
  };
  return keys.filter((key) => !credentials[key]).map((key) => labels[key]);
}
