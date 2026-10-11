import type { ChannelPlatform } from "@/features/channels";
import { httpClient } from "@/infrastructure/api/http-client";
import type {
  AssignVideoInput,
  CategoryAutomation,
  CategoryAutomationInput,
  PlanItem,
  PlannerMessage,
  PlannerProvider,
  PlannerReply,
  PublishNowInput,
  QueueEntry,
  QueueEntryFilters,
  QueueSource as QueueSourceType,
  QueueStatus,
  QueueVideoInput,
  SavedPlanItem,
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

// ── Automatización por categoría + planificador con IA ──────────────────────

// El planificador usa un LLM: puede tardar 2–3 minutos.
const PLANNER_TIMEOUT_MS = 300_000;

interface CategoryAutomationDto {
  category_id: string;
  display_name: string;
  status: CategoryAutomation["status"];
  engine: CategoryAutomation["engine"];
  default_cadence: CategoryAutomation["defaultCadence"];
  slots: ScheduleSlotDto[];
}

export async function getCategoryAutomations(signal?: AbortSignal): Promise<CategoryAutomation[]> {
  const dtos = await httpClient<CategoryAutomationDto[]>("/api/v1/schedule/categories", {
    signal,
  });
  return dtos.map((dto) => ({
    categoryId: dto.category_id,
    displayName: dto.display_name,
    status: dto.status,
    engine: dto.engine,
    defaultCadence: dto.default_cadence,
    slots: dto.slots.map(mapScheduleSlot),
  }));
}

export async function saveCategoryAutomation(
  input: CategoryAutomationInput,
): Promise<ScheduleSlot[]> {
  const dtos = await httpClient<ScheduleSlotDto[]>("/api/v1/schedule/categories", {
    method: "POST",
    body: {
      category_path: input.categoryPath,
      accounts: input.accounts,
      cadence: input.cadence,
      days: input.cadence === "custom" ? (input.days ?? []) : null,
      times: input.times,
    },
  });
  return dtos.map(mapScheduleSlot);
}

interface PlanItemDto {
  date: string;
  time: string;
  category_path: string;
  design: string | null;
  topic: string;
  angle?: string;
  description?: string;
}

interface SavedPlanItemDto extends PlanItemDto {
  item_id: string;
  production_id?: string | null;
  production_state?: string | null;
  video_id?: string | null;
  created_at?: string;
}

function mapPlanItem(dto: PlanItemDto): PlanItem {
  return {
    date: dto.date,
    time: dto.time,
    categoryPath: dto.category_path,
    design: dto.design ?? null,
    topic: dto.topic,
    angle: dto.angle ?? "",
    description: dto.description ?? "",
  };
}

function toPlanItemDto(item: PlanItem): PlanItemDto {
  return {
    date: item.date,
    time: item.time,
    category_path: item.categoryPath,
    design: item.design,
    topic: item.topic,
    angle: item.angle,
    description: item.description,
  };
}

function mapSavedPlanItem(dto: SavedPlanItemDto): SavedPlanItem {
  return {
    ...mapPlanItem(dto),
    itemId: dto.item_id,
    productionId: dto.production_id ?? null,
    productionState: dto.production_state ?? null,
    videoId: dto.video_id ?? null,
    createdAt: dto.created_at ?? "",
  };
}

export async function plannerChat(input: {
  messages: PlannerMessage[];
  weekStart?: string;
  provider?: PlannerProvider;
}): Promise<PlannerReply> {
  const dto = await httpClient<{ reply: string; items: PlanItemDto[]; warnings: string[] }>(
    "/api/v1/schedule/planner/chat",
    {
      method: "POST",
      body: {
        messages: input.messages,
        week_start: input.weekStart || null,
        provider: input.provider ?? null,
      },
      timeoutMs: PLANNER_TIMEOUT_MS,
    },
  );
  return { reply: dto.reply, items: dto.items.map(mapPlanItem), warnings: dto.warnings ?? [] };
}

export async function savePlanItems(items: PlanItem[]): Promise<SavedPlanItem[]> {
  const dtos = await httpClient<SavedPlanItemDto[]>("/api/v1/schedule/planner/items", {
    method: "POST",
    body: { items: items.map(toPlanItemDto) },
  });
  return dtos.map(mapSavedPlanItem);
}

export async function getPlanItems(
  fromDate?: string,
  signal?: AbortSignal,
): Promise<SavedPlanItem[]> {
  const qs = buildQueryString({ from_date: fromDate });
  const dtos = await httpClient<SavedPlanItemDto[]>(`/api/v1/schedule/planner/items${qs}`, {
    signal,
  });
  return dtos.map(mapSavedPlanItem);
}

export async function deletePlanItem(itemId: string): Promise<void> {
  await httpClient<void>(`/api/v1/schedule/planner/items/${itemId}`, { method: "DELETE" });
}

export async function producePlanItem(input: {
  itemId: string;
  agent?: string;
  autoRecord?: boolean;
}): Promise<{ itemId: string; productionId: string; videoId: string }> {
  const dto = await httpClient<{ item_id: string; production_id: string; video_id: string }>(
    `/api/v1/schedule/planner/items/${input.itemId}/produce`,
    {
      method: "POST",
      body: { agent: input.agent ?? null, auto_record: input.autoRecord ?? true },
    },
  );
  return { itemId: dto.item_id, productionId: dto.production_id, videoId: dto.video_id };
}
