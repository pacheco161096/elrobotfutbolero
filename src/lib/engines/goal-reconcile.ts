export type TrackedGoal = {
  playerId: number;
  minute: number | null;
  extra: number | null;
  player: string | null;
  team: string | null;
  detail: string | null;
};

export type StoredGoal = TrackedGoal & { id: string };

export type GoalPlan = {
  insert: TrackedGoal[];
  update: Array<{ id: string; goal: TrackedGoal }>;
};

function stamp(goal: { minute: number | null; extra: number | null }): number {
  return (goal.minute ?? 0) * 100 + (goal.extra ?? 0);
}

export function reconcileGoals(stored: StoredGoal[], incoming: TrackedGoal[]): GoalPlan {
  const incomingByPlayer = new Map<number, TrackedGoal[]>();
  for (const goal of incoming) {
    const list = incomingByPlayer.get(goal.playerId) ?? [];
    list.push(goal);
    incomingByPlayer.set(goal.playerId, list);
  }
  const storedByPlayer = new Map<number, StoredGoal[]>();
  for (const goal of stored) {
    const list = storedByPlayer.get(goal.playerId) ?? [];
    list.push(goal);
    storedByPlayer.set(goal.playerId, list);
  }

  const insert: TrackedGoal[] = [];
  const update: Array<{ id: string; goal: TrackedGoal }> = [];
  for (const [playerId, goals] of incomingByPlayer) {
    const pool = [...(storedByPlayer.get(playerId) ?? [])];
    const ordered = [...goals].sort((left, right) => stamp(left) - stamp(right));
    for (const goal of ordered) {
      let best = -1;
      let distance = Number.POSITIVE_INFINITY;
      pool.forEach((item, itemIndex) => {
        const gap = Math.abs(stamp(item) - stamp(goal));
        if (gap < distance) {
          distance = gap;
          best = itemIndex;
        }
      });
      if (best >= 0) {
        const [matched] = pool.splice(best, 1);
        update.push({ id: matched.id, goal });
      } else {
        insert.push(goal);
      }
    }
  }
  return { insert, update };
}

export function goalKey(fixtureId: string, goal: TrackedGoal, index: number): string {
  return ["fx", fixtureId, "GOAL", "pid", goal.playerId, goal.minute ?? "x", goal.extra ?? 0, index].join(":");
}
