import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";
import type { JobDetail, JobFile, JobStage, JobSummary } from "../types";

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
  files: JobFileDto[];
  summary: JobSummaryDto | null;
}

function mapJobSummary(dto: JobSummaryDto): JobSummary {
  return {
    youtubeTitle: dto.youtube_title,
    youtubeDescription: dto.youtube_description,
    youtubeTags: dto.youtube_tags,
    tiktokCaption: dto.tiktok_caption,
    tiktokHashtags: dto.tiktok_hashtags,
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
    files: dto.files.map((f) => ({ ...f, url: f.url ? resolveApiUrl(f.url) : null })),
    summary: dto.summary ? mapJobSummary(dto.summary) : null,
  };
}

export async function getJobStatus(jobId: string, signal?: AbortSignal): Promise<JobDetail> {
  const dto = await httpClient<JobDetailDto>(`/api/v1/videos/jobs/${jobId}`, { signal });
  return mapJobDetail(dto);
}
