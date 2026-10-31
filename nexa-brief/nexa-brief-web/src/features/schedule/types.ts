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
  /** Archivo publicado ("16x9" / "9x16"); null = el que le corresponde a la plataforma. */
  format?: string | null;
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

/** Relación de aspecto de un archivo del video. */
export type VideoFormat = "16x9" | "9x16";

export interface PublishNowInput {
  jobId: string;
  idempotencyKey: string;
  platform: ChannelPlatform;
  accountAlias: string;
  /** Archivo a subir; sin valor, el que corresponde a la plataforma. */
  format?: VideoFormat;
}

// ── Automatización por categoría + planificador con IA ──────────────────────

export type CategoryCadence = "daily" | "alternate" | "custom";

export interface CategoryAutomation {
  categoryId: string;
  displayName: string;
  status: "active" | "planned" | "empty";
  engine: "pipeline" | "explainer_kit";
  defaultCadence: "daily" | "alternate";
  slots: ScheduleSlot[];
}

export interface CategoryAutomationInput {
  categoryPath: string;
  /** Selectores "plataforma:alias". */
  accounts: string[];
  cadence: CategoryCadence;
  /** Solo con cadence "custom". */
  days?: Weekday[];
  /** "HH:MM" en UTC. */
  times: string[];
}

export interface PlannerMessage {
  role: "user" | "assistant";
  content: string;
}

/** Un ítem propuesto por el planificador (mismo shape que guarda el backend). */
export interface PlanItem {
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  categoryPath: string;
  design: string | null;
  topic: string;
  angle: string;
  description: string;
}

export interface PlannerReply {
  reply: string;
  items: PlanItem[];
  warnings: string[];
}

export type PlannerProvider = "deepseek" | "claude" | "codex";

export interface SavedPlanItem extends PlanItem {
  itemId: string;
  productionId: string | null;
  productionState: string | null;
  videoId: string | null;
  createdAt: string;
}
