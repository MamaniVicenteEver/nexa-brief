import { Queue } from "bullmq";
import type { EngineName } from "../engines/port.js";
import { redisConnection } from "./connection.js";
import type { RenderJobData } from "./types.js";

export const ENGINE_NAMES: EngineName[] = ["playwright", "remotion", "hyperframes"];

export function queueNameFor(engine: EngineName): string {
  // BullMQ no permite ":" en nombres de cola.
  return `render-${engine}`;
}

const queues: Record<EngineName, Queue<RenderJobData>> = Object.fromEntries(
  ENGINE_NAMES.map((engine) => [
    engine,
    new Queue<RenderJobData>(queueNameFor(engine), { connection: redisConnection }),
  ]),
) as Record<EngineName, Queue<RenderJobData>>;

export function getQueue(engine: EngineName): Queue<RenderJobData> {
  return queues[engine];
}

export function allQueues(): Queue<RenderJobData>[] {
  return Object.values(queues);
}

export async function closeQueues(): Promise<void> {
  await Promise.all(allQueues().map((q) => q.close()));
}
