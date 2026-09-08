import type { EngineName, EngineResult, Fps, RenderInput, VideoFormat, WorkerTarget } from "../engines/port.js";

/** Payload guardado como `job.data` en BullMQ — es la fuente de verdad del
 * job, no se duplica en una estructura Redis aparte (ver server/README.md,
 * sección "Modelo de jobs"). */
export interface RenderJobData {
  input: RenderInput;
  engine: EngineName;
  worker: WorkerTarget;
  fps: Fps;
  formats: VideoFormat[];
  audioUrl?: string;
  durationSeconds?: number;
  createdAt: string;
}

/** `job.returnvalue` en BullMQ cuando el job termina bien. */
export type RenderJobReturn = EngineResult;
