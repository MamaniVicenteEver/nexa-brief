import type { EngineName, EngineResult, Fps, RenderInput, VideoFormat, WorkerTarget } from "../engines/port.js";

export type JobStatus = "queued" | "running" | "completed" | "failed";

/**
 * Modelo mínimo — deliberadamente NO la máquina de estados de 9 etapas que
 * usa nexa-brief-server (core/job.py). Ese modelo está atado a un pipeline de
 * marketing con nichos/publicación; acá un job es solo "input -> resultado".
 */
export interface RenderJob {
  id: string;
  input: RenderInput;
  engineRequested: EngineName | "auto";
  engineUsed?: EngineName;
  worker: WorkerTarget;
  fps: Fps;
  formats: VideoFormat[];
  audioUrl?: string;
  durationSeconds?: number;
  status: JobStatus;
  result?: EngineResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitJobInput {
  input: RenderInput;
  engine?: EngineName | "auto";
  worker?: WorkerTarget;
  fps?: Fps;
  formats?: VideoFormat[];
  audioUrl?: string;
  /** Respaldo cuando ni un archivo multimedia ni el código declaran duración. */
  durationSeconds?: number;
}
