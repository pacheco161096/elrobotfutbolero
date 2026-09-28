import pg from "pg";

export type Overrides = {
  pauseAll: boolean;
  pausePublishing: boolean;
  pauseLive: boolean;
  pauseImages: boolean;
  pauseContext: boolean;
  safeMode: boolean;
  blockedSources: string[];
  blockedTopics: string[];
  blockedWords: string[];
  blockedPeople: string[];
};

export const emptyOverrides = (): Overrides => ({
  pauseAll: false,
  pausePublishing: false,
  pauseLive: false,
  pauseImages: false,
  pauseContext: false,
  safeMode: false,
  blockedSources: [],
  blockedTopics: [],
  blockedWords: [],
  blockedPeople: [],
});

let current = emptyOverrides();

export function getOverrides(): Overrides {
  return {
    ...current,
    blockedSources: [...current.blockedSources],
    blockedTopics: [...current.blockedTopics],
    blockedWords: [...current.blockedWords],
    blockedPeople: [...current.blockedPeople],
  };
}

export function setOverrides(next: Overrides): Overrides {
  current = {
    ...next,
    blockedSources: [...next.blockedSources],
    blockedTopics: [...next.blockedTopics],
    blockedWords: [...next.blockedWords],
    blockedPeople: [...next.blockedPeople],
  };
  return getOverrides();
}

function cleanList(values: string[]): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const value of values) {
    const text = value.trim().slice(0, 80);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    list.push(text);
    if (list.length >= 40) break;
  }
  return list;
}

export function normalizeOverrides(input: Partial<Overrides>): Overrides {
  return {
    pauseAll: Boolean(input.pauseAll),
    pausePublishing: Boolean(input.pausePublishing),
    pauseLive: Boolean(input.pauseLive),
    pauseImages: Boolean(input.pauseImages),
    pauseContext: Boolean(input.pauseContext),
    safeMode: Boolean(input.safeMode),
    blockedSources: cleanList(input.blockedSources ?? []),
    blockedTopics: cleanList(input.blockedTopics ?? []),
    blockedWords: cleanList(input.blockedWords ?? []),
    blockedPeople: cleanList(input.blockedPeople ?? []),
  };
}

type FlagRow = {
  pause_all: boolean;
  pause_publishing: boolean;
  pause_live: boolean;
  pause_images: boolean;
  pause_context: boolean;
  safe_mode: boolean;
  blocked_sources: string[];
  blocked_topics: string[];
  blocked_words: string[];
  blocked_people: string[];
};

export async function refreshOverrides(databaseUrl: string | undefined): Promise<Overrides> {
  if (!databaseUrl) return getOverrides();
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<FlagRow>(
      `SELECT pause_all, pause_publishing, pause_live, pause_images, pause_context, safe_mode,
              blocked_sources, blocked_topics, blocked_words, blocked_people
       FROM control_flags WHERE id = 1`,
    );
    const row = result.rows[0];
    if (!row) return getOverrides();
    return setOverrides(normalizeOverrides({
      pauseAll: row.pause_all,
      pausePublishing: row.pause_publishing,
      pauseLive: row.pause_live,
      pauseImages: row.pause_images,
      pauseContext: row.pause_context,
      safeMode: row.safe_mode,
      blockedSources: row.blocked_sources,
      blockedTopics: row.blocked_topics,
      blockedWords: row.blocked_words,
      blockedPeople: row.blocked_people,
    }));
  } finally {
    await client.end();
  }
}

export async function persistOverrides(databaseUrl: string, input: Partial<Overrides>): Promise<Overrides> {
  const overrides = setOverrides(normalizeOverrides(input));
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO control_flags (
         id, pause_all, pause_publishing, pause_live, pause_images, pause_context, safe_mode,
         blocked_sources, blocked_topics, blocked_words, blocked_people, updated_at
       ) VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
       ON CONFLICT (id) DO UPDATE SET
         pause_all = EXCLUDED.pause_all,
         pause_publishing = EXCLUDED.pause_publishing,
         pause_live = EXCLUDED.pause_live,
         pause_images = EXCLUDED.pause_images,
         pause_context = EXCLUDED.pause_context,
         safe_mode = EXCLUDED.safe_mode,
         blocked_sources = EXCLUDED.blocked_sources,
         blocked_topics = EXCLUDED.blocked_topics,
         blocked_words = EXCLUDED.blocked_words,
         blocked_people = EXCLUDED.blocked_people,
         updated_at = now()`,
      [
        overrides.pauseAll,
        overrides.pausePublishing,
        overrides.pauseLive,
        overrides.pauseImages,
        overrides.pauseContext,
        overrides.safeMode,
        overrides.blockedSources,
        overrides.blockedTopics,
        overrides.blockedWords,
        overrides.blockedPeople,
      ],
    );
    await client.query(`DELETE FROM blacklist_rules WHERE rule_type IN ('word', 'person')`);
    for (const value of overrides.blockedWords) {
      await client.query(
        `INSERT INTO blacklist_rules (rule_type, value) VALUES ('word', $1) ON CONFLICT (rule_type, value) DO NOTHING`,
        [value],
      );
    }
    for (const value of overrides.blockedPeople) {
      await client.query(
        `INSERT INTO blacklist_rules (rule_type, value) VALUES ('person', $1) ON CONFLICT (rule_type, value) DO NOTHING`,
        [value],
      );
    }
  } finally {
    await client.end();
  }
  return overrides;
}
