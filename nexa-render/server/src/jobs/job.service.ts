import type { Job } from "bullmq";
import { getEngine, selectEngine } from "../engines/factory.js";
import { env } from "../config/env.js";
import type { EngineName } from "../engines/port.js";
import { ENGINE_NAMES, getQueue } from "../queue/queues.js";
import type { RenderJobData, RenderJobReturn } from "../queue/types.js";
import { newJobId } from "../sandbox/limits.js";
import type { JobStatus, RenderJob, SubmitJobInput } from "./job.model.js";
import { initializeJobArtifacts, markJobFailed } from "../artifacts/artifact-store.js";
import { logger } from "../observability/logger.js";

/**
 * Único punto de entrada para "meter un job a la cola" y "consultar su
 * estado" — usado tanto por api/routes/jobs.routes.ts como por
 * mcp/tools/render.tool.ts y get-status.tool.ts, para que REST y MCP nunca
 * diverjan en comportamiento (ver server/README.md → "Verificación").
 */
export async function submitJob(payload: SubmitJobInput): Promise<{ jobId: string; engineUsed: EngineName }> {
  const requestedEngine = payload.engine ?? "auto";

  logger.info({
    event: "job_submission_received",
    requestedEngine,
    inputKind: payload.input.kind,
    worker: payload.worker ?? "local",
    fps: payload.fps ?? 30,
    formats: payload.formats ?? ["desktop"],
    hasAudio: Boolean(payload.audioUrl),
    durationSeconds: payload.durationSeconds,
  });

  if (requestedEngine !== "auto" && !ENGINE_NAMES.includes(requestedEngine)) {
    throw new Error(`Motor desconocido: '${requestedEngine}'. Válidos: ${ENGINE_NAMES.join(", ")}, auto`);
  }

  const engine = requestedEngine === "auto" ? selectEngine(payload.input) : getEngine(requestedEngine);

  if ((payload.worker ?? "local") === "aws") {
    if (engine.name === "playwright") {
      throw new WorkerNotImplementedError("aws para Playwright; use Remotion o HyperFrames");
    }
    if (engine.name === "remotion" && !env.REMOTION_AWS_FUNCTION_NAME) {
      throw new Error("AWS Remotion no está configurado: falta REMOTION_AWS_FUNCTION_NAME.");
    }
    if (engine.name === "hyperframes" && (!env.HYPERFRAMES_AWS_STACK_NAME || !env.HYPERFRAMES_AWS_BUCKET || !env.HYPERFRAMES_AWS_STATE_MACHINE_ARN)) {
      throw new Error("AWS HyperFrames no está configurado: faltan stack, bucket o state machine ARN.");
    }
  }

  const data: RenderJobData = {
    input: payload.input,
    engine: engine.name,
    worker: payload.worker ?? "local",
    fps: payload.fps ?? 30,
    formats: payload.formats ?? ["desktop"],
    audioUrl: payload.audioUrl,
    durationSeconds: payload.durationSeconds,
    createdAt: new Date().toISOString(),
  };

  // Id propio (UUID), NO el autoincremental default de BullMQ — ese contador
  // es POR COLA, así que dos jobs en colas distintas (motores distintos)
  // pueden terminar con el mismo id ("1", "2", ...) y pisarse en getJob(),
  // que busca por id a través de las 3 colas.
  const jobId = newJobId();
  const queue = getQueue(engine.name);
  await initializeJobArtifacts(jobId, data);
  try {
    const bullJob = await queue.add(`render-${engine.name}`, data, { jobId });
    logger.info({ event: "job_enqueued", jobId: bullJob.id, engine: engine.name, queue: `render-${engine.name}` });
    return { jobId: bullJob.id!, engineUsed: engine.name };
  } catch (error) {
    await markJobFailed(jobId, engine.name, error);
    logger.error({ event: "job_enqueue_failed", jobId, engine: engine.name, err: error });
    throw error;
  }
}

export async function getJob(jobId: string): Promise<RenderJob | null> {
  for (const engineName of ENGINE_NAMES) {
    const queue = getQueue(engineName);
    const bullJob = (await queue.getJob(jobId)) as Job<RenderJobData, RenderJobReturn> | undefined;
    if (bullJob) return toRenderJob(bullJob);
  }
  return null;
}

async function toRenderJob(bullJob: Job<RenderJobData, RenderJobReturn>): Promise<RenderJob> {
  const state = await bullJob.getState();
  return {
    id: bullJob.id!,
    input: bullJob.data.input,
    engineRequested: bullJob.data.engine,
    engineUsed: bullJob.data.engine,
    worker: bullJob.data.worker,
    fps: bullJob.data.fps,
    formats: bullJob.data.formats,
    audioUrl: bullJob.data.audioUrl,
    durationSeconds: bullJob.data.durationSeconds,
    status: mapState(state),
    result: bullJob.returnvalue ?? undefined,
    error: bullJob.failedReason,
    createdAt: bullJob.data.createdAt,
    updatedAt: new Date(bullJob.timestamp).toISOString(),
  };
}

function mapState(state: string): JobStatus {
  switch (state) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "active":
      return "running";
    default:
      return "queued"; // waiting, delayed, waiting-children, etc.
  }
}

export class WorkerNotImplementedError extends Error {
  readonly status = 501;
  constructor(worker: string) {
    super(`El worker '${worker}' no está disponible para este motor.`);
  }
}
