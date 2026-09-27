export type QueueJob = {
  idempotencyKey: string;
  type: "FLASH" | "CONTEXT";
  priority: number;
  status: "queued" | "running" | "done" | "failed";
  attempts: number;
};

export function enqueueJob(
  queue: QueueJob[],
  job: Pick<QueueJob, "idempotencyKey" | "type" | "priority">,
): { queue: QueueJob[]; created: boolean } {
  if (queue.some((item) => item.idempotencyKey === job.idempotencyKey)) {
    return { queue, created: false };
  }
  return {
    queue: [...queue, { ...job, status: "queued", attempts: 0 }],
    created: true,
  };
}

export function nextJob(queue: QueueJob[]): QueueJob | null {
  const waiting = queue.filter((job) => job.status === "queued");
  waiting.sort((a, b) => b.priority - a.priority);
  return waiting[0] ?? null;
}
