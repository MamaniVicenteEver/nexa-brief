import { createReadStream, existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { env } from "../config/env.js";
import type { EngineName } from "../engines/port.js";
import { logger } from "../observability/logger.js";

const ENGINES = ["playwright", "remotion", "hyperframes"] as const;

const MetadataSchema = z.object({
  jobId: z.string(),
  engine: z.enum(ENGINES),
  status: z.string(),
  timestamps: z.object({
    createdAt: z.string(),
    completedAt: z.string().optional(),
    updatedAt: z.string(),
  }),
  request: z.object({
    fps: z.number(),
  }),
  outputs: z.array(z.object({
    format: z.enum(["desktop", "mobile"]),
    filename: z.string(),
    bytes: z.number(),
    durationSeconds: z.number().optional(),
    codec: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    fps: z.number().optional(),
  })),
});

export interface OutputGalleryQuery {
  page: number;
  pageSize: number;
  engine?: EngineName;
  format?: "desktop" | "mobile";
}

export async function listOutputVideos(query: OutputGalleryQuery) {
  const jobs = (await Promise.all(ENGINES.map(readEngineJobs))).flat();
  const completed = jobs.filter((job) => job.status === "completed");
  const categories = ENGINES.map((engine) => ({
    engine,
    count: completed.filter((job) => job.engine === engine).reduce((total, job) => total + job.outputs.length, 0),
  }));

  const items = completed
    .filter((job) => !query.engine || job.engine === query.engine)
    .flatMap((job) => job.outputs
      .filter((output) => !query.format || output.format === query.format)
      .map((output) => ({
        id: `${job.jobId}-${output.format}`,
        jobId: job.jobId,
        engine: job.engine,
        format: output.format,
        filename: output.filename,
        fps: output.fps ?? job.request.fps,
        bytes: output.bytes,
        durationSeconds: output.durationSeconds,
        codec: output.codec,
        width: output.width,
        height: output.height,
        completedAt: job.timestamps.completedAt ?? job.timestamps.updatedAt,
        videoUrl: `/files/${encodeURIComponent(job.jobId)}/${encodeURIComponent(output.filename)}`,
      })))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;

  logger.info({ event: "output_gallery_listed", page, pageSize: query.pageSize, totalItems, engine: query.engine });
  return {
    items: items.slice(start, start + query.pageSize),
    categories,
    pagination: {
      page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
  };
}

export function openOutputVideo(jobId: string, filename: string) {
  const safeJobId = path.basename(jobId);
  const safeFilename = path.basename(filename);
  for (const engine of ENGINES) {
    const outputDir = path.resolve(env.OUT_DIR, engine, safeJobId, "outputs");
    const candidate = path.resolve(outputDir, safeFilename);
    if (candidate.startsWith(`${outputDir}${path.sep}`) && existsSync(candidate)) {
      return { stream: createReadStream(candidate), engine, path: candidate };
    }
  }
  return null;
}

async function readEngineJobs(engine: EngineName): Promise<Array<z.infer<typeof MetadataSchema>>> {
  const engineDir = path.resolve(env.OUT_DIR, engine);
  let entries;
  try {
    entries = await readdir(engineDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn({ event: "output_gallery_engine_read_failed", engine, error });
    }
    return [];
  }

  const jobs = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const metadataPath = path.join(engineDir, entry.name, "metadata.json");
    try {
      return MetadataSchema.parse(JSON.parse(await readFile(metadataPath, "utf-8")));
    } catch (error) {
      logger.warn({ event: "output_gallery_metadata_skipped", engine, metadataPath, error });
      return null;
    }
  }));
  return jobs.filter((job): job is z.infer<typeof MetadataSchema> => job !== null);
}
