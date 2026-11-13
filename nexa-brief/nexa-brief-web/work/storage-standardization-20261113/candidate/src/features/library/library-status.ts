import type { JobListItem, JobStage } from "@/features/create-video/types";
import type { QueueEntry } from "@/features/schedule";
import { resolveApiUrl } from "@/infrastructure/api/http-client";

/** Estado "de negocio" de un video en Biblioteca — combina el stage del job
 * con la cola de publicación: un job `packaged` que ya tiene una entrada
 * `published` cuenta como publicado aunque el stage no se haya movido. */
export type LibraryStatus = "ready" | "scheduled" | "published" | "processing" | "failed";

export interface LibraryVideo {
  job: JobListItem;
  status: LibraryStatus;
  categoryLabel: string;
  published: QueueEntry[];
  scheduled: QueueEntry[];
}

/** Orden del pipeline, para la barra de progreso de los videos en proceso. */
const PIPELINE: JobStage[] = [
  "pending",
  "input_analyzed",
  "design_complete",
  "resources_fetched",
  "prompt_built",
  "html_generated",
  "video_recorded",
  "summary_generated",
  "packaged",
];

export function stageProgress(stage: JobStage): number {
  const index = PIPELINE.indexOf(stage);
  if (index < 0) return stage === "publishing" ? 0.95 : 0;
  return (index + 1) / PIPELINE.length;
}

export function deriveStatus(
  job: JobListItem,
  published: QueueEntry[],
  scheduled: QueueEntry[],
): LibraryStatus {
  if (job.stage === "failed") return "failed";
  if (job.stage === "published" || published.length > 0) return "published";
  if (!job.isTerminal) return "processing";
  return scheduled.length > 0 ? "scheduled" : "ready";
}

export function hasRenderedVideo(status: LibraryStatus): boolean {
  return status === "ready" || status === "scheduled" || status === "published";
}

/** Mismo criterio que el backend (`video_deletion._STALE_AFTER`): un job en
 * proceso que no avanza hace 30 min quedó colgado y ya se puede eliminar. */
const STALE_AFTER_MS = 30 * 60_000;

export function canDelete(video: LibraryVideo): boolean {
  if (video.status !== "processing") return true;
  return Date.now() - new Date(video.job.updatedAt).getTime() > STALE_AFTER_MS;
}

export function jobFileUrl(jobId: string, format: "youtube" | "reels"): string {
  return resolveApiUrl(`/api/v1/videos/jobs/${jobId}/file/${format}`);
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Tiempo de generación legible: "45 s", "3 min 12 s", "1 h 5 min". */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  return rest ? `${m} min ${rest} s` : `${m} min`;
}

/** "lyrics_video_neon" → "Lyrics Video Neon" cuando el nicho no tiene display name. */
export function humanizeCategory(category: string): string {
  return category
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
