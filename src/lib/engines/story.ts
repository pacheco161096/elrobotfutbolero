import type { EventType, IncomingEvent, StoryRef } from "@/lib/domain/types";

const CONTROVERSY = new Set<EventType>(["PENALTY", "VAR", "COMPLAINT", "MISSED_PENALTY"]);

export function storyKeyFor(event: Pick<IncomingEvent, "fixtureId" | "eventType" | "minute" | "team" | "player">, existing: StoryRef[]): string {
  const controversyKey = `fixture:${event.fixtureId}:controversia`;
  const hasControversy = existing.some((story) => story.key === controversyKey);
  if (CONTROVERSY.has(event.eventType) || (event.eventType === "GOAL" && hasControversy)) {
    return controversyKey;
  }
  if (event.eventType === "GOAL") {
    return `fixture:${event.fixtureId}:gol:${event.minute ?? "x"}:${event.team ?? "x"}`;
  }
  if (event.eventType === "SUSPENDED" || event.eventType === "RESUMPTION") {
    return `fixture:${event.fixtureId}:suspension`;
  }
  return [
    "fixture",
    event.fixtureId,
    event.eventType,
    event.minute ?? "na",
    event.team ?? "na",
    event.player ?? "na",
  ].join(":");
}

export function resolveStory(event: IncomingEvent, key: string): {
  key: string;
  action: "create" | "update" | "attach_source";
  story?: StoryRef;
  scoreChanged: boolean;
  typeChanged: boolean;
} {
  const story = event.existingStories.find((item) => item.key === key);
  if (!story) {
    return { key, action: "create", scoreChanged: false, typeChanged: false };
  }
  const scoreChanged =
    event.homeScore != null &&
    event.awayScore != null &&
    (event.homeScore !== (story.homeScore ?? null) || event.awayScore !== (story.awayScore ?? null));
  const typeChanged = event.eventType !== story.lastEventType;
  const newlyContradicted = event.sources.some((source) => source.stance === "contradice") && story.claimStatus !== "CONTRADICTED";
  if (scoreChanged || typeChanged || newlyContradicted) {
    return { key, action: "update", story, scoreChanged, typeChanged };
  }
  return { key, action: "attach_source", story, scoreChanged, typeChanged };
}
