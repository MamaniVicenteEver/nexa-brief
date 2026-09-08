import { Worker, type Job } from "bullmq";
import { execa } from "execa";
import { env } from "../config/env.js";
import { getEngine } from "../engines/factory.js";
import type { EngineName } from "../engines/port.js";
import { cleanupJobWorkDir, createJobWorkDir, withTimeout } from "../sandbox/limits.js";
import { resolveRemoteAssets } from "../sandbox/remote-assets.js";
import { markJobFailed, markJobRunning, persistCompletedJob } from "../artifacts/artifact-store.js";
import { logger } from "../observability/logger.js";
import { redisConnection } from "./connection.js";
import { queueNameFor } from "./queues.js";
import type { RenderJobData, RenderJobReturn } from "./types.js";

const CONCURRENCY: Record<EngineName, number> = {
  playwright: env.PLAYWRIGHT_CONCURRENCY,
  remotion: env.REMOTION_CONCURRENCY,
  hyperframes: env.HYPERFRAMES_CONCURRENCY,
};

async function process(job: Job<RenderJobData, RenderJobReturn>): Promise<RenderJobReturn> {
  const engine = getEngine(job.data.engine);
  const workDir = await createJobWorkDir(job.id!);
  const startedAt = Date.now();
  let stopResolvedAssets: (() => Promise<void>) | undefined;

  logger.info({ event: "job_started", jobId: job.id, engine: engine.name, workDir });
  await markJobRunning(job.id!, engine.name);

  try {
    const resolvedAssets = await resolveRemoteAssets(job.data.input, job.data.audioUrl, {
      workDir,
      allowlist: env.NETWORK_ALLOWLIST,
      timeoutMs: env.REMOTE_ASSET_TIMEOUT_MS,
      maxBytes: env.REMOTE_ASSET_MAX_BYTES,
      maxRedirects: env.REMOTE_ASSET_MAX_REDIRECTS,
    });
    stopResolvedAssets = resolvedAssets.stop;
    const durationSeconds = await resolveDuration({ ...job.data, input: resolvedAssets.input, audioUrl: resolvedAssets.audioPath ? `file://${resolvedAssets.audioPath}` : undefined });
    const audioPath = resolvedAssets.audioPath;

    logger.info({
      event: "job_inputs_resolved",
      jobId: job.id,
      engine: engine.name,
      durationSeconds,
      hasAudio: Boolean(audioPath),
      formats: job.data.formats,
      fps: job.data.fps,
    });

    const rawResult = await withTimeout(
      engine.render(resolvedAssets.input, {
        jobId: job.id!,
        worker: job.data.worker,
        workDir,
        fps: job.data.fps,
        formats: job.data.formats,
        audioPath,
        audioUrl: resolvedAssets.audioUrl,
        assetOrigin: resolvedAssets.origin,
        assetDir: resolvedAssets.assetDir,
        durationSeconds,
        timeoutMs: job.data.worker === "aws" ? env.AWS_RENDER_TIMEOUT_MS : env.JOB_TIMEOUT_MS,
        networkAllowlist: env.NETWORK_ALLOWLIST,
      }),
      env.JOB_TIMEOUT_MS,
    );
    // Persistir en OUT_DIR ANTES de limpiar workDir — el finally de abajo
    // borra `workDir`, y ahí es donde engine.render() dejó los .mp4.
    logger.info({ event: "engine_render_completed", jobId: job.id, engine: engine.name, stats: rawResult.stats });
    const result = await persistCompletedJob(job.id!, engine.name, rawResult);
    logger.info({
      event: "job_completed",
      jobId: job.id,
      engine: engine.name,
      elapsedMs: Date.now() - startedAt,
      outputs: result.outputs,
    });
    return result;
  } catch (error) {
    await markJobFailed(job.id!, engine.name, error).catch((metadataError) => {
      logger.error({ event: "job_failure_metadata_failed", jobId: job.id, engine: engine.name, err: metadataError });
    });
    logger.error({ event: "job_failed", jobId: job.id, engine: engine.name, elapsedMs: Date.now() - startedAt, err: error });
    throw error;
  } finally {
    await stopResolvedAssets?.();
    await cleanupJobWorkDir(workDir);
    logger.debug({ event: "job_workdir_cleaned", jobId: job.id, engine: engine.name, workDir });
  }
}

async function resolveDuration(data: RenderJobData): Promise<number> {
  const mediaPath = findLocalMediaPath(data.input, data.audioUrl);
  if (mediaPath) {
    const duration = await probeDuration(mediaPath);
    if (duration) return duration;
  }

  const declared = findDeclaredDuration(data.input);
  if (declared) return declared;
  return data.durationSeconds ?? env.DEFAULT_STATIC_DURATION_SECONDS;
}

function findLocalMediaPath(input: RenderJobData["input"], audioUrl?: string): string | undefined {
  const source = input.kind === "html"
    ? input.html.match(/<(?:video|audio)\b[^>]*\bsrc=["']file:\/\/([^"']+)["']/i)?.[1]
    : undefined;
  return source ?? (audioUrl?.startsWith("file://") ? audioUrl.slice("file://".length) : undefined);
}

function findDeclaredDuration(input: RenderJobData["input"]): number | undefined {
  if (input.kind === "html") {
    const value = Number(input.html.match(/data-duration=["']([\d.]+)["']/i)?.[1]);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  const value = input.props?.durationSeconds;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

async function probeDuration(filePath: string): Promise<number | undefined> {
  try {
    const { stdout } = await execa("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath,
    ]);
    const duration = Number(stdout.trim());
    return Number.isFinite(duration) && duration > 0 ? duration : undefined;
  } catch (error) {
    logger.warn({ event: "media_duration_probe_failed", filePath, err: error });
    return undefined;
  }
}

let workers: Worker[] = [];

export function startWorkers(): Worker[] {
  workers = (Object.keys(CONCURRENCY) as EngineName[]).map(
    (engine) => {
      const worker = new Worker<RenderJobData, RenderJobReturn>(queueNameFor(engine), process, {
        connection: redisConnection,
        concurrency: CONCURRENCY[engine],
      });
      worker.on("ready", () => logger.info({ event: "worker_ready", engine, concurrency: CONCURRENCY[engine] }));
      worker.on("stalled", (jobId) => logger.warn({ event: "job_stalled", jobId, engine }));
      worker.on("error", (error) => logger.error({ event: "worker_error", engine, err: error }));
      return worker;
    },
  );
  return workers;
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
}
