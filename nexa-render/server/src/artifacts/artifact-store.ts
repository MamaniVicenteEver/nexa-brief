import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { env } from "../config/env.js";
import type { EngineName, EngineResult, RenderInput } from "../engines/port.js";
import type { RenderJobData } from "../queue/types.js";
import { logger } from "../observability/logger.js";

export type ArtifactStatus = "queued" | "running" | "completed" | "failed";

interface ResourceMetadata {
  name: string;
  relativePath: string;
  bytes: number;
  mimeType: string;
  source: "request" | "local-file";
}

interface VideoMetadata {
  format: string;
  filename: string;
  relativePath: string;
  bytes: number;
  mimeType: "video/mp4";
  durationSeconds?: number;
  codec?: string;
  width?: number;
  height?: number;
  fps?: number;
}

interface JobArtifactMetadata {
  schemaVersion: 1;
  jobId: string;
  engine: EngineName;
  status: ArtifactStatus;
  timestamps: {
    createdAt: string;
    queuedAt: string;
    startedAt?: string;
    completedAt?: string;
    failedAt?: string;
    updatedAt: string;
  };
  request: {
    inputKind: RenderInput["kind"];
    worker: RenderJobData["worker"];
    fps: RenderJobData["fps"];
    formats: RenderJobData["formats"];
    audioUrl?: string;
    durationSeconds?: number;
  };
  resources: ResourceMetadata[];
  outputs: VideoMetadata[];
  stats?: Record<string, unknown>;
  error?: { message: string; name?: string; stack?: string };
}

export function getJobArtifactDir(engine: EngineName, jobId: string): string {
  return path.resolve(env.OUT_DIR, engine, path.basename(jobId));
}

export async function initializeJobArtifacts(jobId: string, data: RenderJobData): Promise<void> {
  const jobDir = getJobArtifactDir(data.engine, jobId);
  const resourcesDir = path.join(jobDir, "resources");
  await mkdir(resourcesDir, { recursive: true });
  await mkdir(path.join(jobDir, "outputs"), { recursive: true });

  const resources = await persistInputResources(resourcesDir, data.input, data.audioUrl);
  const now = new Date().toISOString();
  const metadata: JobArtifactMetadata = {
    schemaVersion: 1,
    jobId,
    engine: data.engine,
    status: "queued",
    timestamps: { createdAt: data.createdAt, queuedAt: now, updatedAt: now },
    request: {
      inputKind: data.input.kind,
      worker: data.worker,
      fps: data.fps,
      formats: data.formats,
      audioUrl: data.audioUrl,
      durationSeconds: data.durationSeconds,
    },
    resources,
    outputs: [],
  };
  await writeMetadata(jobDir, metadata);
  logger.info({ event: "artifacts_initialized", jobId, engine: data.engine, jobDir, resources: resources.length });
}

export async function markJobRunning(jobId: string, engine: EngineName): Promise<void> {
  await updateMetadata(engine, jobId, (metadata) => {
    const now = new Date().toISOString();
    metadata.status = "running";
    metadata.timestamps.startedAt = now;
    metadata.timestamps.updatedAt = now;
    return metadata;
  });
}

export async function persistCompletedJob(
  jobId: string,
  engine: EngineName,
  result: EngineResult,
): Promise<EngineResult> {
  const jobDir = getJobArtifactDir(engine, jobId);
  const outputsDir = path.join(jobDir, "outputs");
  await mkdir(outputsDir, { recursive: true });

  const outputs = [];
  const outputMetadata: VideoMetadata[] = [];
  for (const output of result.outputs) {
    const filename = `${output.format}${path.extname(output.path) || ".mp4"}`;
    const destPath = path.join(outputsDir, filename);
    await copyFile(output.path, destPath);
    outputs.push({ format: output.format, path: destPath });
    outputMetadata.push(await inspectVideo(destPath, output.format, filename));
  }

  await updateMetadata(engine, jobId, (metadata) => {
    const now = new Date().toISOString();
    metadata.status = "completed";
    metadata.outputs = outputMetadata;
    metadata.stats = result.stats;
    metadata.timestamps.completedAt = now;
    metadata.timestamps.updatedAt = now;
    delete metadata.error;
    return metadata;
  });

  logger.info({ event: "artifacts_persisted", jobId, engine, outputs: outputMetadata });
  return { outputs, stats: result.stats };
}

export async function markJobFailed(jobId: string, engine: EngineName, error: unknown): Promise<void> {
  await updateMetadata(engine, jobId, (metadata) => {
    const now = new Date().toISOString();
    const normalized = normalizeError(error);
    metadata.status = "failed";
    metadata.error = normalized;
    metadata.timestamps.failedAt = now;
    metadata.timestamps.updatedAt = now;
    return metadata;
  });
}

async function persistInputResources(
  resourcesDir: string,
  input: RenderInput,
  audioUrl?: string,
): Promise<ResourceMetadata[]> {
  const files: Array<{ name: string; content: string; mimeType: string }> = [];
  if (input.kind === "html") {
    files.push({ name: "input.html", content: input.html, mimeType: "text/html" });
    if (input.css !== undefined) files.push({ name: "styles.css", content: input.css, mimeType: "text/css" });
    if (input.js !== undefined) files.push({ name: "script.js", content: input.js, mimeType: "text/javascript" });
  } else {
    files.push({ name: "Component.jsx", content: input.componentSource, mimeType: "text/jsx" });
    files.push({ name: "props.json", content: JSON.stringify(input.props ?? {}, null, 2), mimeType: "application/json" });
  }

  const resources: ResourceMetadata[] = [];
  for (const file of files) {
    const destination = path.join(resourcesDir, file.name);
    await writeFile(destination, file.content, "utf-8");
    resources.push({
      name: file.name,
      relativePath: path.posix.join("resources", file.name),
      bytes: Buffer.byteLength(file.content),
      mimeType: file.mimeType,
      source: "request",
    });
  }

  if (audioUrl?.startsWith("file://")) {
    const sourcePath = audioUrl.slice("file://".length);
    const extension = path.extname(sourcePath) || ".bin";
    const name = `audio${extension}`;
    const destination = path.join(resourcesDir, name);
    await copyFile(sourcePath, destination);
    const info = await stat(destination);
    resources.push({
      name,
      relativePath: path.posix.join("resources", name),
      bytes: info.size,
      mimeType: audioMimeType(extension),
      source: "local-file",
    });
  }
  return resources;
}

async function inspectVideo(
  filePath: string,
  format: string,
  filename: string,
): Promise<VideoMetadata> {
  const info = await stat(filePath);
  const metadata: VideoMetadata = {
    format,
    filename,
    relativePath: path.posix.join("outputs", filename),
    bytes: info.size,
    mimeType: "video/mp4",
  };
  try {
    const { stdout } = await execa("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_name,width,height,avg_frame_rate:format=duration",
      "-of", "json",
      filePath,
    ]);
    const probe = JSON.parse(stdout) as {
      streams?: Array<{ codec_name?: string; width?: number; height?: number; avg_frame_rate?: string }>;
      format?: { duration?: string };
    };
    const stream = probe.streams?.[0];
    metadata.codec = stream?.codec_name;
    metadata.width = stream?.width;
    metadata.height = stream?.height;
    metadata.durationSeconds = probe.format?.duration ? Number(probe.format.duration) : undefined;
    metadata.fps = parseFps(stream?.avg_frame_rate);
  } catch (error) {
    logger.warn({ event: "video_probe_failed", filePath, error: normalizeError(error) });
  }
  return metadata;
}

async function updateMetadata(
  engine: EngineName,
  jobId: string,
  update: (metadata: JobArtifactMetadata) => JobArtifactMetadata,
): Promise<void> {
  const jobDir = getJobArtifactDir(engine, jobId);
  const metadataPath = path.join(jobDir, "metadata.json");
  const metadata = JSON.parse(await readFile(metadataPath, "utf-8")) as JobArtifactMetadata;
  await writeMetadata(jobDir, update(metadata));
}

async function writeMetadata(jobDir: string, metadata: JobArtifactMetadata): Promise<void> {
  const target = path.join(jobDir, "metadata.json");
  const temporary = `${target}.tmp`;
  await writeFile(temporary, `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");
  await rename(temporary, target);
}

function parseFps(value?: string): number | undefined {
  if (!value) return undefined;
  const [numerator, denominator] = value.split("/").map(Number);
  if (!numerator || !denominator) return undefined;
  return Number((numerator / denominator).toFixed(3));
}

function audioMimeType(extension: string): string {
  const types: Record<string, string> = { ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac" };
  return types[extension.toLowerCase()] ?? "application/octet-stream";
}

function normalizeError(error: unknown): { message: string; name?: string; stack?: string } {
  if (error instanceof Error) return { message: error.message, name: error.name, stack: error.stack };
  return { message: String(error) };
}
