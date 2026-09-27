export type Overrides = {
  pauseAll: boolean;
  pausePublishing: boolean;
  pauseLive: boolean;
  pauseImages: boolean;
  pauseContext: boolean;
  safeMode: boolean;
  blockedSources: string[];
  blockedTopics: string[];
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
});

let current = emptyOverrides();

export function getOverrides(): Overrides {
  return {
    ...current,
    blockedSources: [...current.blockedSources],
    blockedTopics: [...current.blockedTopics],
  };
}

export function setOverrides(next: Overrides): Overrides {
  current = {
    ...next,
    blockedSources: [...next.blockedSources],
    blockedTopics: [...next.blockedTopics],
  };
  return getOverrides();
}
