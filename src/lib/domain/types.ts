export const EVENT_TYPES = [
  "GOAL",
  "RED_CARD",
  "YELLOW_CARD",
  "PENALTY",
  "MISSED_PENALTY",
  "VAR",
  "SUBSTITUTION",
  "INJURY",
  "HALFTIME",
  "FULL_TIME",
  "SUSPENDED",
  "RESUMPTION",
  "RESCHEDULED",
  "CANCELLED",
  "CORNER",
  "STATEMENT",
  "REACTION",
  "STAT",
  "INCIDENT",
  "COMPLAINT",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type SourceKind =
  | "oficial"
  | "api"
  | "periodista"
  | "medio"
  | "local"
  | "fanpage"
  | "usuario";

export type TruthStatus =
  | "DATO_CONFIRMADO"
  | "DATO_PROBABLE"
  | "AFIRMACION_DE_UNA_FUENTE"
  | "INFORMACION_NO_CONFIRMADA"
  | "CONTRADICCION";

export type ClaimStatus =
  | "CONFIRMED"
  | "SUPPORTED"
  | "UNCONFIRMED"
  | "CONTRADICTED"
  | "UNKNOWN";

export type Importance = "MUY_ALTO" | "ALTO" | "MEDIO" | "BAJO" | "IGNORAR";

export type EditorialDecision =
  | "PUBLISH_NOW"
  | "PUBLISH_CONTEXT"
  | "WAIT"
  | "MONITOR"
  | "DISCARD"
  | "UPDATE_EXISTING_STORY";

export type SourceRef = {
  kind: SourceKind;
  stance: "apoya" | "contradice";
  name: string;
};

export type StoryRef = {
  key: string;
  lastEventType: string;
  homeScore?: number | null;
  awayScore?: number | null;
  claimStatus?: string;
};

export type RecentPost = {
  fixtureId: string;
  storyKey: string;
  importance: Importance;
  createdAt: string;
};

export type IncomingEvent = {
  fixtureId: string;
  apiEventId?: string;
  eventType: EventType;
  minute?: number;
  player?: string;
  team?: string;
  detail?: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number | null;
  awayScore?: number | null;
  origin: "api_event" | "claim";
  sources: SourceRef[];
  text?: string;
  topics?: string[];
  impact?: "normal" | "important";
  hasRealImage?: boolean;
  botIsProtagonist?: boolean;
  meme?: boolean;
  cause?: { text?: string; sources: SourceRef[] };
  existingStories: StoryRef[];
  recentPosts: RecentPost[];
};
