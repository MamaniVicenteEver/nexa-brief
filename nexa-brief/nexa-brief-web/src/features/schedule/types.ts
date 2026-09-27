import type { ChannelPlatform } from "@/features/channels";

export type { ChannelPlatform };

/** 0=lunes..6=domingo, igual a `datetime.weekday()` en el backend. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ScheduleSlot {
  slotId: string;
  platform: ChannelPlatform;
  accountAlias: string;
  days: Weekday[];
  /** "HH:MM", 24h, UTC. */
  times: string[];
  enabled: boolean;
  nicheFilter: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleSlotInput {
  platform: ChannelPlatform;
  accountAlias: string;
  days: Weekday[];
  times: string[];
  enabled?: boolean;
  nicheFilter?: string | null;
}

export type ScheduleSlotUpdateInput = Partial<ScheduleSlotInput>;

export interface AssignVideoInput {
  occurrenceDate: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  jobId: string | null; // null => limpia la asignación manual (vuelve a auto-fill)
}

export type QueueStatus =
  | "queued"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled"
  /** El post se eliminó de la plataforma desde Nexa Brief. */
  | "removed";

export type QueueSource = "manual" | "auto" | "immediate";

export interface QueueEntry {
  entryId: string;
  jobId: string;
  platform: ChannelPlatform;
  accountAlias: string;
  slotId: string | null;
  scheduledAt: string | null;
  source: QueueSource;
  status: QueueStatus;
  postId: string | null;
  url: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
}

export interface QueueEntryFilters {
  status?: QueueStatus;
  platform?: ChannelPlatform;
  accountAlias?: string;
  jobId?: string;
  limit?: number;
  offset?: number;
}

export interface QueueVideoInput {
  jobId: string;
  platform: ChannelPlatform;
  accountAlias: string;
  scheduledAt: string;
}

export interface PublishNowInput {
  jobId: string;
  platform: ChannelPlatform;
  accountAlias: string;
}
