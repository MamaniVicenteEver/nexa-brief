import type { JobListItem } from "@/features/create-video/types";
import type { ExplainerJob, Production } from "@/features/explainer/types";
import type { QueueEntry, SavedPlanItem } from "../types";

export type AgendaKind = "plan" | "preparation" | "render" | "publication";
export type AgendaStatus =
  | "planned"
  | "scheduled"
  | "queued"
  | "active"
  | "ready"
  | "done"
  | "failed"
  | "cancelled";

export interface AgendaEvent {
  id: string;
  kind: AgendaKind;
  title: string;
  category: string | null;
  at: string | null;
  status: AgendaStatus;
  phase: string | null;
  videoId: string | null;
  plan?: SavedPlanItem;
  production?: Production;
  recording?: ExplainerJob;
  publication?: QueueEntry;
  error: string | null;
}

const ACTIVE = new Set([
  "creating",
  "producing",
  "finishing",
  "recording",
  "rendering",
  "publishing",
]);

function productionStatus(state: string | null, at: string | null, now: number): AgendaStatus {
  if (state === "failed" || state === "incomplete") return "failed";
  if (state === "ready") return "ready";
  if (state === "done") return "done";
  if (state && ACTIVE.has(state)) return "active";
  if (state === "queued") return at && Date.parse(at) > now ? "scheduled" : "queued";
  return "planned";
}

/** Batch generation_at is an absolute instant. Legacy editorial plan dates are UTC. */
export function planInstant(item: SavedPlanItem): string | null {
  const value = item.generationAt || `${item.date}T${item.time}:00Z`;
  return Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

export function buildAgenda(input: {
  plans: SavedPlanItem[];
  productions: Production[];
  recordings: ExplainerJob[];
  publications: QueueEntry[];
  jobs: JobListItem[];
  now?: number;
}): AgendaEvent[] {
  const now = input.now ?? Date.now();
  const productions = new Map(input.productions.map((p) => [p.productionId, p]));
  const linked = new Set(input.plans.map((p) => p.productionId).filter(Boolean));
  const recordings = new Map(input.recordings.map((r) => [r.jobId, r]));
  const byLibrary = new Map(
    input.recordings.filter((r) => r.scheduledJobId).map((r) => [r.scheduledJobId, r]),
  );
  const jobs = new Map(input.jobs.map((j) => [j.jobId, j]));
  const events: AgendaEvent[] = input.plans.map((plan) => {
    const production = plan.productionId ? productions.get(plan.productionId) : undefined;
    const at = planInstant(plan);
    return {
      id: `plan:${plan.itemId}`,
      kind: plan.generationAt ? "preparation" : "plan",
      title: plan.topic,
      category: plan.categoryPath,
      at,
      status: productionStatus(production?.state ?? plan.productionState, at, now),
      phase: production?.phase ?? null,
      videoId: production?.videoId ?? plan.videoId,
      plan,
      production,
      recording: production?.recordJobId ? recordings.get(production.recordJobId) : undefined,
      error: production?.error ?? null,
    };
  });
  for (const production of input.productions) {
    if (linked.has(production.productionId)) continue;
    events.push({
      id: `production:${production.productionId}`,
      kind: "preparation",
      title: production.topic,
      category: production.categoryPath,
      at: production.createdAt || null,
      status: productionStatus(production.state, null, now),
      phase: production.phase,
      videoId: production.videoId,
      production,
      recording: production.recordJobId ? recordings.get(production.recordJobId) : undefined,
      error: production.error,
    });
  }
  for (const recording of input.recordings) {
    events.push({
      id: `render:${recording.jobId}`,
      kind: "render",
      title: recording.title || recording.videoId,
      category: recording.categoryPath,
      at: recording.startedAt,
      status:
        recording.state === "failed"
          ? "failed"
          : recording.state === "done"
            ? "done"
            : recording.state === "queued"
              ? "queued"
              : "active",
      phase: recording.state === "publishing" ? "publishing" : recording.progressPhase,
      videoId: recording.videoId,
      recording,
      error: recording.error,
    });
  }
  for (const publication of input.publications) {
    const recording = byLibrary.get(publication.jobId) ?? recordings.get(publication.jobId);
    const library = jobs.get(publication.jobId);
    events.push({
      id: `publication:${publication.entryId}`,
      kind: "publication",
      title: library?.title || recording?.title || recording?.videoId || publication.jobId,
      category: recording?.categoryPath ?? library?.category ?? null,
      at: publication.scheduledAt || publication.processedAt || publication.createdAt,
      status:
        publication.status === "published"
          ? "done"
          : publication.status === "publishing"
            ? "active"
            : publication.status === "failed"
              ? "failed"
              : publication.status === "queued"
                ? "scheduled"
                : "cancelled",
      phase: null,
      videoId: recording?.videoId ?? null,
      publication,
      recording,
      error: publication.error,
    });
  }
  return events.sort((a, b) => {
    // Work without a start date stays visible after dated events.
    const left = a.at ? Date.parse(a.at) : Infinity;
    const right = b.at ? Date.parse(b.at) : Infinity;
    return left - right || a.id.localeCompare(b.id);
  });
}

export function dateInZone(instant: string | number, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function shiftDay(day: string, delta: number): string {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + delta);
  return value.toISOString().slice(0, 10);
}

export function filterAgenda(
  events: AgendaEvent[],
  filters: {
    kind: AgendaKind | "all";
    day: string;
    range: "day" | "week" | "all";
    zone: string;
    search: string;
    status: "all" | "active" | "attention" | "upcoming";
  },
): AgendaEvent[] {
  const search = filters.search.trim().toLocaleLowerCase();
  return events.filter((event) => {
    if (
      filters.kind !== "all" &&
      event.kind !== filters.kind &&
      !(filters.kind === "preparation" && event.kind === "plan")
    )
      return false;
    if (
      search &&
      !`${event.title} ${event.category ?? ""} ${event.videoId ?? ""}`
        .toLocaleLowerCase()
        .includes(search)
    )
      return false;
    if (filters.status === "active" && event.status !== "active" && event.status !== "queued")
      return false;
    if (filters.status === "attention" && event.status !== "failed") return false;
    if (filters.status === "upcoming" && !["planned", "scheduled", "queued"].includes(event.status))
      return false;
    if (!event.at || filters.range === "all") return true;
    const day = dateInZone(event.at, filters.zone);
    return filters.range === "day"
      ? day === filters.day
      : day >= filters.day && day < shiftDay(filters.day, 7);
  });
}
