import pg from "pg";
import { getOverrides, refreshOverrides } from "@/lib/control/overrides";
import { acceptImageText, IMAGE_READ_LIMIT } from "@/lib/engines/image-text";
import {
  acceptSpeechBundle,
  speechAction,
  speechKeep,
  speechPromptBlock,
  type SpeechKind,
  type SpeechNote,
} from "@/lib/engines/speech";
import { interpretInstructions } from "@/lib/engines/voice-brief";
import { estimateUsd, recordAiUsage } from "@/lib/integrations/ai-cost";
import { brightDataMissing, facebookPageUrls, pollSocialSearch, triggerSocialSearch } from "@/lib/integrations/bright-data";
import { downloadImage, readImageTexts } from "@/lib/integrations/image-ocr";
import type { SocialHit } from "@/lib/engines/context";

const JOB_KEY = "speech:collect";
const HIT_LIMIT = 16;

export type SpeechResult = {
  status: "idle" | "pending_credentials" | "triggered" | "pending" | "ready" | "error";
  saved?: number;
  missing?: string[];
  message?: string;
};

type SpeechPayload = { snapshotId?: string; startedAt?: string; lockAt?: string };

let earCache: { at: number; block: string; url: string } | null = null;

export function clearSpeechEar(): void {
  earCache = null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withClient<T>(databaseUrl: string, run: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function writeLog(databaseUrl: string, level: string, message: string, context: unknown): Promise<void> {
  await withClient(databaseUrl, (client) =>
    client.query(`INSERT INTO system_logs (level, area, message, context) VALUES ($1,'habla',$2,$3::jsonb)`, [
      level,
      message,
      JSON.stringify(context ?? {}),
    ]),
  );
}

async function loadJob(client: pg.Client): Promise<{ status: "running" | "done" | "failed"; payload: SpeechPayload; updatedAt: string } | null> {
  const result = await client.query<{ status: string; payload: SpeechPayload | null; updated_at: Date }>(
    `SELECT status, payload, updated_at FROM jobs WHERE idempotency_key = $1`,
    [JOB_KEY],
  );
  const row = result.rows[0];
  if (!row || (row.status !== "running" && row.status !== "done" && row.status !== "failed")) return null;
  return {
    status: row.status,
    payload: row.payload ?? {},
    updatedAt: row.updated_at.toISOString(),
  };
}

async function claim(client: pg.Client, now: Date): Promise<SpeechPayload | null> {
  const lockAt = now.toISOString();
  const result = await client.query<{ payload: SpeechPayload }>(
    `UPDATE jobs
     SET payload = payload || $2::jsonb, updated_at = now()
     WHERE idempotency_key = $1
       AND status = 'running'
       AND (payload->>'lockAt' IS NULL OR payload->>'lockAt' < $3)
     RETURNING payload`,
    [JOB_KEY, JSON.stringify({ lockAt }), new Date(now.getTime() - 90_000).toISOString()],
  );
  return result.rows[0]?.payload ?? null;
}

async function saveNotes(client: pg.Client, notes: SpeechNote[], now: Date): Promise<number> {
  await client.query(`DELETE FROM speech_notes WHERE expires_at <= $1`, [now]);
  for (const note of notes) {
    await client.query(
      `INSERT INTO speech_notes (kind, body, fingerprint, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (fingerprint) DO UPDATE
       SET body = EXCLUDED.body, expires_at = EXCLUDED.expires_at, created_at = now()`,
      [note.kind, note.body, note.fingerprint, note.expiresAt],
    );
  }
  for (const kind of ["frase", "tendencia", "visual"] as const) {
    await client.query(
      `DELETE FROM speech_notes WHERE id IN (
         SELECT id FROM speech_notes WHERE kind = $1 ORDER BY created_at DESC OFFSET $2
       )`,
      [kind, speechKeep(kind)],
    );
  }
  clearSpeechEar();
  return notes.length;
}

function blocked(note: SpeechNote, words: string[]): boolean {
  const text = note.body.toLowerCase();
  return words.some((word) => word && text.includes(word.toLowerCase()));
}

async function distill(
  hits: SocialHit[],
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
  now: Date,
): Promise<SpeechNote[] | null> {
  const sources = hits.map((hit) => hit.text);
  const material = hits
    .map((hit, index) => `${index + 1}. ${hit.imageUrl ? "Con imagen. " : ""}${hit.text.slice(0, 280)}`)
    .join("\n");
  let speech = "";
  try {
    speech = await loadSpeechBlock(env, now);
  } catch {
    speech = "";
  }
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: interpretInstructions(speech, "Interpretas publicaciones públicas de México con la personalidad y con el diccionario. No son hechos. No las copies. No nombres páginas ni autores. Devuelves solo JSON con esta forma: {\"frases\":[],\"tendencias\":[],\"visual\":[]}. frases: cómo se está hablando, el giro o la muletilla, una línea corta cada una, con ortografía correcta. No es un chiste para publicar ni una cita. tendencias: un gancho que podría caer en un partido, una línea, vacío si no hay. visual: cómo se ve el formato, una línea, sin pedir que se copie una foto. Máximo 4 frases, 2 tendencias y 1 visual. Si el material no deja habla, devuelve listas vacías."),
        },
        { role: "user", content: material },
      ],
    }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  const promptTokens = body.usage?.prompt_tokens ?? 0;
  const completionTokens = body.usage?.completion_tokens ?? 0;
  if (promptTokens || completionTokens) {
    await recordAiUsage(
      { area: "habla", model, promptTokens, completionTokens, usd: estimateUsd(model, promptTokens, completionTokens) },
      env,
    );
  }
  const words = [...getOverrides().blockedWords, ...getOverrides().blockedTopics];
  return acceptSpeechBundle(body.choices?.[0]?.message?.content ?? "", sources, now).filter((note) => !blocked(note, words));
}

async function notesFromImages(
  hits: SocialHit[],
  fetchImpl: typeof fetch,
  now: Date,
  words: string[],
): Promise<SpeechNote[]> {
  const urls: string[] = [];
  for (const hit of hits) {
    if (!hit.imageUrl || urls.includes(hit.imageUrl)) continue;
    urls.push(hit.imageUrl);
    if (urls.length >= IMAGE_READ_LIMIT) break;
  }
  const images: Uint8Array[] = [];
  for (const url of urls) {
    const bytes = await downloadImage(url, fetchImpl);
    if (bytes) images.push(bytes);
  }
  let texts: string[] = [];
  try {
    texts = await readImageTexts(images);
  } catch {
    return [];
  }
  const notes: SpeechNote[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    const note = acceptImageText(text, now);
    if (!note || seen.has(note.fingerprint) || blocked(note, words)) continue;
    seen.add(note.fingerprint);
    notes.push(note);
  }
  return notes;
}

async function finish(
  databaseUrl: string,
  snapshotId: string,
  env: Record<string, string | undefined>,
  now: Date,
  fetchImpl: typeof fetch,
  wait: boolean,
): Promise<SpeechResult> {
  let polled = await pollSocialSearch(snapshotId, env, fetchImpl, HIT_LIMIT, true);
  for (let attempt = 0; wait && polled.status === "pending" && attempt < 3; attempt += 1) {
    await sleep(8_000);
    polled = await pollSocialSearch(snapshotId, env, fetchImpl, HIT_LIMIT, true);
  }
  if (polled.status === "pending") return { status: "pending" };
  if (polled.status === "error") {
    await withClient(databaseUrl, (client) =>
      client.query(`UPDATE jobs SET status = 'failed', last_error = $2, updated_at = now() WHERE idempotency_key = $1`, [JOB_KEY, polled.message]),
    );
    await writeLog(databaseUrl, "error", polled.message, { snapshotId });
    return { status: "error", message: polled.message };
  }
  const words = [...getOverrides().blockedWords, ...getOverrides().blockedTopics];
  const imageNotes = await notesFromImages(polled.hits, fetchImpl, now, words);
  if (imageNotes.length) await withClient(databaseUrl, (client) => saveNotes(client, imageNotes, now));
  const written = polled.hits.filter((hit) => hit.text.trim().length >= 12);
  const distilled = written.length ? await distill(written, env, fetchImpl, now) : [];
  if (!distilled) {
    const message = "No pude leer el habla de las páginas.";
    await withClient(databaseUrl, (client) =>
      client.query(`UPDATE jobs SET status = 'failed', last_error = $2, updated_at = now() WHERE idempotency_key = $1`, [JOB_KEY, message]),
    );
    await writeLog(databaseUrl, "error", message, { snapshotId });
    return { status: "error", message };
  }
  const seen = new Set(imageNotes.map((note) => note.fingerprint));
  const notes = [...imageNotes, ...distilled.filter((note) => !seen.has(note.fingerprint))];
  const saved = await withClient(databaseUrl, async (client) => {
    const count = await saveNotes(client, notes, now);
    await client.query(`UPDATE jobs SET status = 'done', last_error = NULL, updated_at = now() WHERE idempotency_key = $1`, [JOB_KEY]);
    return count;
  });
  const fromImages = imageNotes.length ? ` ${imageNotes.length} salieron de una imagen.` : "";
  await writeLog(databaseUrl, "info", saved ? `Guardé ${saved} notas de habla.${fromImages}` : "Las páginas no dejaron habla nueva.", { saved, images: imageNotes.length });
  return { status: "ready", saved };
}

async function trigger(
  databaseUrl: string,
  env: Record<string, string | undefined>,
  now: Date,
  fetchImpl: typeof fetch,
): Promise<SpeechResult> {
  const pages = facebookPageUrls(env.SPEECH_PAGE_URLS);
  const triggered = await triggerSocialSearch(pages, env, fetchImpl, 4);
  if (triggered.status === "pending_credentials") return { status: "pending_credentials", missing: triggered.missing };
  if (triggered.status === "error") {
    await withClient(databaseUrl, (client) =>
      client.query(
        `INSERT INTO jobs (type, priority, status, idempotency_key, payload, attempts, last_error)
         VALUES ('SPEECH', 20, 'failed', $1, '{}'::jsonb, 1, $2)
         ON CONFLICT (idempotency_key) DO UPDATE
         SET status = 'failed', attempts = jobs.attempts + 1, last_error = EXCLUDED.last_error, updated_at = now()`,
        [JOB_KEY, triggered.message],
      ),
    );
    await writeLog(databaseUrl, "error", triggered.message, {});
    return { status: "error", message: triggered.message };
  }
  await withClient(databaseUrl, (client) =>
    client.query(
      `INSERT INTO jobs (type, priority, status, idempotency_key, payload, attempts)
       VALUES ('SPEECH', 20, 'running', $1, $2::jsonb, 1)
       ON CONFLICT (idempotency_key) DO UPDATE
       SET status = 'running', payload = EXCLUDED.payload, attempts = jobs.attempts + 1, last_error = NULL, updated_at = now()`,
      [JOB_KEY, JSON.stringify({ snapshotId: triggered.snapshotId, startedAt: now.toISOString() })],
    ),
  );
  await writeLog(databaseUrl, "info", "Arranqué la recolección de habla.", { snapshotId: triggered.snapshotId });
  return finish(databaseUrl, triggered.snapshotId, env, now, fetchImpl, true);
}

export async function loadSpeechBlock(
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
): Promise<string> {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) return "";
  if (earCache && earCache.url === databaseUrl && now.getTime() - earCache.at < 5 * 60 * 1000) return earCache.block;
  const notes = await withClient(databaseUrl, async (client) => {
    const result = await client.query<{ kind: SpeechKind; body: string }>(
      `SELECT kind, body FROM speech_notes WHERE expires_at > $1 AND kind = ANY($2::text[]) ORDER BY created_at DESC LIMIT 12`,
      [now, ["frase", "tendencia"]],
    );
    return result.rows;
  });
  const block = speechPromptBlock(notes);
  earCache = { at: now.getTime(), block, url: databaseUrl };
  return block;
}

export async function runSpeech(
  env: Record<string, string | undefined> = process.env,
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
  mode: "start" | "resume" = "start",
): Promise<SpeechResult> {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) return { status: "idle" };
  await refreshOverrides(databaseUrl);
  if (getOverrides().pauseAll || getOverrides().pauseContext) return { status: "idle" };
  const job = await withClient(databaseUrl, loadJob);
  let action = speechAction({
    mode,
    status: job?.status ?? null,
    startedAt: job?.payload.startedAt ?? null,
    finishedAt: job && job.status !== "running" ? job.updatedAt : null,
    now,
  });
  if (action === "expire") {
    await withClient(databaseUrl, (client) =>
      client.query(
        `UPDATE jobs SET status = 'failed', last_error = 'La búsqueda de habla se quedó colgada.', updated_at = now() WHERE idempotency_key = $1 AND status = 'running'`,
        [JOB_KEY],
      ),
    );
    action = mode === "start" ? "trigger" : "idle";
  }
  if (action === "idle") return { status: "idle" };
  const missing = [
    ...brightDataMissing(env).filter((name) => name !== "BRIGHT_DATA_PAGE_URLS"),
    ...(facebookPageUrls(env.SPEECH_PAGE_URLS).length ? [] : ["SPEECH_PAGE_URLS"]),
    ...(env.OPENAI_API_KEY ? [] : ["OPENAI_API_KEY"]),
  ];
  if (missing.length) return { status: "pending_credentials", missing };
  if (action === "trigger") return trigger(databaseUrl, env, now, fetchImpl);
  const claimed = await withClient(databaseUrl, (client) => claim(client, now));
  if (!claimed?.snapshotId) return { status: "pending" };
  return finish(databaseUrl, claimed.snapshotId, env, now, fetchImpl, mode === "start");
}
