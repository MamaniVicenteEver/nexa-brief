import type { ChannelPlatform } from "@/features/channels";
import { httpClient } from "@/infrastructure/api/http-client";
import type {
  AssignVideoInput,
  PublishNowInput,
  QueueEntry,
  QueueEntryFilters,
  QueueSource as QueueSourceType,
  QueueStatus,
  QueueVideoInput,
  ScheduleSlot,
  ScheduleSlotInput,
  ScheduleSlotUpdateInput,
  Weekday,
} from "../types";

// Todo el acoplamiento a los paths/shape exactos de `/api/v1/schedule/*` vive
// únicamente en este archivo — si el backend difiere de lo asumido acá, este
// es el único archivo a tocar (ver plan de integración Programación+Biblioteca).

interface ScheduleSlotDto {
  slot_id: string;
  platform: string;
  account_alias: string;
  days: number[];
  times: string[];
  enabled: boolean;
  niche_filter: string | null;
  created_at: string;
  updated_at: string;
}

function mapScheduleSlot(dto: ScheduleSlotDto): ScheduleSlot {
  return {
    slotId: dto.slot_id,
    platform: dto.platform as ChannelPlatform,
    accountAlias: dto.account_alias,
    days: dto.days as Weekday[],
    times: dto.times,
    enabled: dto.enabled,
    nicheFilter: dto.niche_filter,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

interface QueueEntryDto {
  entry_id: string;
  job_id: string;
  platform: string;
  account_alias: string;
  slot_id: string | null;
  scheduled_at: string | null;
  source: string;
  status: string;
  post_id: string | null;
  url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

function mapQueueEntry(dto: QueueEntryDto): QueueEntry {
  return {
    entryId: dto.entry_id,
    jobId: dto.job_id,
    platform: dto.platform as ChannelPlatform,
    accountAlias: dto.account_alias,
    slotId: dto.slot_id,
    scheduledAt: dto.scheduled_at,
    source: dto.source as QueueSourceType,
    status: dto.status as QueueStatus,
    postId: dto.post_id,
    url: dto.url,
    error: dto.error,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    processedAt: dto.processed_at,
  };
}

export interface ScheduleSlotFilters {
  platform?: ChannelPlatform;
  accountAlias?: string;
  enabled?: boolean;
}

function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function getScheduleSlots(
  filters: ScheduleSlotFilters = {},
  signal?: AbortSignal,
): Promise<ScheduleSlot[]> {
  const qs = buildQueryString({
    platform: filters.platform,
    account_alias: filters.accountAlias,
    enabled: filters.enabled,
  });
  const dtos = await httpClient<ScheduleSlotDto[]>(`/api/v1/schedule/slots${qs}`, { signal });
  return dtos.map(mapScheduleSlot);
}

function toSlotPayload(input: ScheduleSlotInput | ScheduleSlotUpdateInput) {
  return {
    ...("platform" in input && input.platform !== undefined ? { platform: input.platform } : {}),
    ...("accountAlias" in input && input.accountAlias !== undefined
      ? { account_alias: input.accountAlias }
      : {}),
    ...("days" in input && input.days !== undefined ? { days: input.days } : {}),
    ...("times" in input && input.times !== undefined ? { times: input.times } : {}),
    ...("enabled" in input && input.enabled !== undefined ? { enabled: input.enabled } : {}),
    ...("nicheFilter" in input && input.nicheFilter !== undefined
      ? { niche_filter: input.nicheFilter }
      : {}),
  };
}

export async function createScheduleSlot(input: ScheduleSlotInput): Promise<ScheduleSlot> {
  const dto = await httpClient<ScheduleSlotDto>("/api/v1/schedule/slots", {
    method: "POST",
    body: toSlotPayload(input),
  });
  return mapScheduleSlot(dto);
}

export async function updateScheduleSlot(
  slotId: string,
  input: ScheduleSlotUpdateInput,
): Promise<ScheduleSlot> {
  const dto = await httpClient<ScheduleSlotDto>(`/api/v1/schedule/slots/${slotId}`, {
    method: "PUT",
    body: toSlotPayload(input),
  });
  return mapScheduleSlot(dto);
}

export async function deleteScheduleSlot(slotId: string): Promise<void> {
  await httpClient<void>(`/api/v1/schedule/slots/${slotId}`, { method: "DELETE" });
}

export async function assignVideoToSlot(
  slotId: string,
  input: AssignVideoInput,
): Promise<QueueEntry | null> {
  const dto = await httpClient<QueueEntryDto | null>(`/api/v1/schedule/slots/${slotId}/assign`, {
    method: "POST",
    body: {
      occurrence_date: input.occurrenceDate,
      time: input.time,
      job_id: input.jobId,
    },
  });
  return dto ? mapQueueEntry(dto) : null;
}

interface QueueListResponseDto {
  total: number;
  limit: number;
  offset: number;
  entries: QueueEntryDto[];
}

export async function getQueueEntries(
  filters: QueueEntryFilters = {},
  signal?: AbortSignal,
): Promise<QueueEntry[]> {
  const qs = buildQueryString({
    status: filters.status,
    platform: filters.platform,
    account_alias: filters.accountAlias,
    job_id: filters.jobId,
    limit: filters.limit,
    offset: filters.offset,
  });
  const dto = await httpClient<QueueListResponseDto>(`/api/v1/schedule/queue${qs}`, { signal });
  return dto.entries.map(mapQueueEntry);
}

export async function queueVideo(input: QueueVideoInput): Promise<QueueEntry> {
  const dto = await httpClient<QueueEntryDto>("/api/v1/schedule/queue", {
    method: "POST",
    body: {
      job_id: input.jobId,
      platform: input.platform,
      account_alias: input.accountAlias,
      scheduled_at: input.scheduledAt,
    },
  });
  return mapQueueEntry(dto);
}

export async function cancelQueueEntry(entryId: string): Promise<void> {
  await httpClient<void>(`/api/v1/schedule/queue/${entryId}`, { method: "DELETE" });
}

export async function publishNow(input: PublishNowInput): Promise<QueueEntry> {
  const dto = await httpClient<QueueEntryDto>("/api/v1/schedule/publish-now", {
    method: "POST",
    body: {
      job_id: input.jobId,
      platform: input.platform,
      account_alias: input.accountAlias,
    },
  });
  return mapQueueEntry(dto);
}
