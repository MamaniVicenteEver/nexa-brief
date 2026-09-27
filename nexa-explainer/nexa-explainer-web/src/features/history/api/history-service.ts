import { httpClient } from "@/infrastructure/api/http-client";
import type { HistoryEvent, JobTimeline } from "../types";

interface HistoryEventResponseDto {
  event_id: string;
  job_id: string;
  stage: string;
  status: string;
  message: string | null;
  created_at: string;
}

interface JobTimelineResponseDto {
  job_id: string;
  events: HistoryEventResponseDto[];
}

interface HistoryListResponseDto {
  total: number;
  limit: number;
  offset: number;
  events: HistoryEventResponseDto[];
}

function mapHistoryEvent(dto: HistoryEventResponseDto): HistoryEvent {
  return {
    eventId: dto.event_id,
    jobId: dto.job_id,
    stage: dto.stage,
    status: dto.status as HistoryEvent["status"],
    message: dto.message,
    createdAt: dto.created_at,
  };
}

export async function getJobHistory(jobId: string, signal?: AbortSignal): Promise<JobTimeline> {
  const dto = await httpClient<JobTimelineResponseDto>(
    `/api/v1/videos/${encodeURIComponent(jobId)}/history`,
    { signal },
  );
  return { jobId: dto.job_id, events: dto.events.map(mapHistoryEvent) };
}

export interface ListHistoryParams {
  stage?: string;
  limit?: number;
  offset?: number;
}

export async function listHistory(
  params: ListHistoryParams = {},
  signal?: AbortSignal,
): Promise<{ events: HistoryEvent[]; total: number }> {
  const search = new URLSearchParams();
  if (params.stage) search.set("stage", params.stage);
  search.set("limit", String(params.limit ?? 20));
  search.set("offset", String(params.offset ?? 0));

  const dto = await httpClient<HistoryListResponseDto>(`/api/v1/history?${search.toString()}`, {
    signal,
  });
  return { events: dto.events.map(mapHistoryEvent), total: dto.total };
}
