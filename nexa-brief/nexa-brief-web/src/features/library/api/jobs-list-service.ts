import type { JobListItem, JobStage } from "@/features/create-video/types";
import { httpClient } from "@/infrastructure/api/http-client";

interface JobListItemDto {
  job_id: string;
  category: string;
  title: string;
  stage: JobStage;
  is_terminal: boolean;
  created_at: string;
  updated_at: string;
  duration_seconds: number | null;
  generation_seconds: number | null;
}

interface JobListResponseDto {
  total: number;
  limit: number;
  offset: number;
  jobs: JobListItemDto[];
}

function mapJobListItem(dto: JobListItemDto): JobListItem {
  return {
    jobId: dto.job_id,
    category: dto.category,
    title: dto.title,
    stage: dto.stage,
    isTerminal: dto.is_terminal,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    durationSeconds: dto.duration_seconds,
    generationSeconds: dto.generation_seconds,
  };
}

export async function getJobs(signal?: AbortSignal): Promise<JobListItem[]> {
  const dto = await httpClient<JobListResponseDto>("/api/v1/videos/jobs?limit=100", { signal });
  return dto.jobs.map(mapJobListItem);
}
