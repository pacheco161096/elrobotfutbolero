-- PostgreSQL es la fuente de estado. No usar Supabase.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id text UNIQUE NOT NULL,
  home_team text NOT NULL,
  away_team text NOT NULL,
  home_score int,
  away_score int,
  status text NOT NULL,
  kickoff_at timestamptz,
  league text,
  minute int,
  last_change_at timestamptz,
  suspended_since timestamptz,
  last_polled_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id),
  fixture_id text NOT NULL,
  api_event_id text,
  idempotency_key text UNIQUE NOT NULL,
  event_type text NOT NULL,
  minute int,
  player text,
  team text,
  home_score int,
  away_score int,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text NOT NULL,
  url text,
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_key text UNIQUE NOT NULL,
  fixture_id text,
  title text NOT NULL,
  status text NOT NULL,
  last_event_type text,
  home_score int,
  away_score int,
  claim_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES stories(id),
  claim text NOT NULL,
  status text NOT NULL,
  confidence text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claim_sources (
  claim_id uuid REFERENCES claims(id) ON DELETE CASCADE,
  source_id uuid REFERENCES sources(id),
  stance text NOT NULL,
  source_timestamp timestamptz,
  PRIMARY KEY (claim_id, source_id, stance)
);

CREATE TABLE IF NOT EXISTS news_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES stories(id),
  source_id uuid REFERENCES sources(id),
  title text,
  url text,
  summary text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS story_sources (
  story_id uuid REFERENCES stories(id) ON DELETE CASCADE,
  source_id uuid REFERENCES sources(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, source_id)
);

CREATE TABLE IF NOT EXISTS editorial_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid,
  event_id uuid,
  decision text NOT NULL,
  reason text NOT NULL,
  importance text,
  confidence text,
  source_count int,
  contradiction_status text,
  cooldown_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid,
  event_id uuid,
  kind text NOT NULL,
  idempotency_key text UNIQUE NOT NULL,
  body text,
  facts jsonb NOT NULL,
  tone text,
  image_mode text,
  status text NOT NULL,
  club text,
  format text,
  facebook_post_id text,
  engagement jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id),
  idempotency_key text NOT NULL,
  response jsonb,
  external_id text,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  priority int NOT NULL,
  status text NOT NULL,
  idempotency_key text UNIQUE NOT NULL,
  payload jsonb NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  run_after timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jobs_queue_idx ON jobs (status, priority DESC, run_after);

CREATE TABLE IF NOT EXISTS bot_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  memory_key text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, memory_key)
);

CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL,
  area text NOT NULL,
  message text NOT NULL,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS control_flags (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pause_all boolean NOT NULL DEFAULT false,
  pause_publishing boolean NOT NULL DEFAULT false,
  pause_live boolean NOT NULL DEFAULT false,
  pause_images boolean NOT NULL DEFAULT false,
  pause_context boolean NOT NULL DEFAULT false,
  safe_mode boolean NOT NULL DEFAULT false,
  blocked_sources text[] NOT NULL DEFAULT '{}',
  blocked_topics text[] NOT NULL DEFAULT '{}',
  blocked_words text[] NOT NULL DEFAULT '{}',
  blocked_people text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO control_flags (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE control_flags ADD COLUMN IF NOT EXISTS blocked_words text[] NOT NULL DEFAULT '{}';
ALTER TABLE control_flags ADD COLUMN IF NOT EXISTS blocked_people text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS standings (
  season int NOT NULL,
  rank int NOT NULL,
  team text NOT NULL,
  played int,
  won int,
  draw int,
  lost int,
  goals_for int,
  goals_against int,
  points int,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season, team)
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  model text NOT NULL,
  prompt_tokens int NOT NULL DEFAULT 0,
  completion_tokens int NOT NULL DEFAULT 0,
  usd numeric(12, 6),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blacklist_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_type, value)
);
