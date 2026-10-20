import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";
import type {
  JobDetail,
  JobFile,
  JobProgress,
  JobProgressStatus,
  JobStage,
  JobSummary,
} from "../types";

interface JobFileDto {
  format: JobFile["format"];
  ready: boolean;
  url: string | null;
}

interface JobSummaryDto {
  youtube_title: string;
  youtube_description: string;
  youtube_tags: string[];
  tiktok_caption: string;
  tiktok_hashtags: string[];
  pinned_comment?: string;
  platform_copies?: Record<string, { title: string; description: string; tags: string[] }>;
}

export interface JobProgressDto {
  job_id: string;
  status: JobProgressStatus;
  step: string | null;
  step_index: number;
  step_count: number;
  percent: number;
  step_percent: number | null;
  queue_position: number | null;
  eta_seconds: number | null;
}

export interface JobDetailDto {
  job_id: string;
  category: string;
  title: string;
  stage: JobStage;
  is_terminal: boolean;
  is_success: boolean;
  errors: string[];
  created_at: string;
  updated_at: string;
  duration_seconds: number | null;
  generation_seconds: number | null;
  files: JobFileDto[];
  formats?: string[];
  summary: JobSummaryDto | null;
  progress?: JobProgressDto | null;
}

export function mapJobProgress(dto: JobProgressDto): JobProgress {
  return {
    status: dto.status,
    step: dto.step,
    stepIndex: dto.step_index,
    stepCount: dto.step_count,
    percent: dto.percent,
    stepPercent: dto.step_percent,
    queuePosition: dto.queue_position,
    etaSeconds: dto.eta_seconds,
  };
}

function mapJobSummary(dto: JobSummaryDto): JobSummary {
  return {
    youtubeTitle: dto.youtube_title,
    youtubeDescription: dto.youtube_description,
    youtubeTags: dto.youtube_tags,
    tiktokCaption: dto.tiktok_caption,
    tiktokHashtags: dto.tiktok_hashtags,
    pinnedComment: dto.pinned_comment ?? "",
    platformCopies: dto.platform_copies ?? {},
  };
}

export function mapJobDetail(dto: JobDetailDto): JobDetail {
  return {
    jobId: dto.job_id,
    category: dto.category,
    title: dto.title,
    stage: dto.stage,
    isTerminal: dto.is_terminal,
    isSuccess: dto.is_success,
    errors: dto.errors,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    durationSeconds: dto.duration_seconds,
    generationSeconds: dto.generation_seconds ?? null,
    files: dto.files.map((f) => ({ ...f, url: f.url ? resolveApiUrl(f.url) : null })),
    formats: dto.formats ?? [],
    summary: dto.summary ? mapJobSummary(dto.summary) : null,
    progress: dto.progress ? mapJobProgress(dto.progress) : null,
  };
}

export async function getJobStatus(jobId: string, signal?: AbortSignal): Promise<JobDetail> {
  const dto = await httpClient<JobDetailDto>(`/api/v1/videos/jobs/${jobId}`, { signal });
  return mapJobDetail(dto);
}
