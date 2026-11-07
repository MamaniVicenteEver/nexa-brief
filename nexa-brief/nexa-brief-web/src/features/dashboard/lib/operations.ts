import type { JobListItem } from "@/features/create-video/types";
import type { AgendaEvent } from "@/features/schedule/lib/agenda";
import type { DashboardAlert, UpcomingPublication } from "@/features/stats/types";

export interface DashboardWork {
  id: string;
  title: string;
  category: string | null;
  kind: "preparation" | "render" | "publication" | "pipeline";
  status: "active" | "queued";
  phase: string | null;
  progress: number | null;
  href: string;
}

/** A preparation, its recorder and its library copy describe one running video.
 * Prefer the recorder; keep independent publication destinations as separate work. */
export function currentWork(events: AgendaEvent[], jobs: JobListItem[]): DashboardWork[] {
  const work = new Map<string, DashboardWork>();
  const linkedJobs = new Set(
    events.flatMap((e) => (e.recording?.scheduledJobId ? [e.recording.scheduledJobId] : [])),
  );
  for (const event of [...events].sort(
    (a, b) => Number(a.kind === "render") - Number(b.kind === "render"),
  )) {
    if (event.status !== "active" && event.status !== "queued") continue;
    if (event.kind === "plan" && !event.production) continue;
    const kind =
      event.production?.state === "recording"
        ? "render"
        : event.kind === "plan"
          ? "preparation"
          : event.kind;
    const key = kind === "publication" ? event.id : event.videoId || event.id;
    const progress =
      event.recording?.state === "rendering"
        ? Math.min(100, Math.max(0, Math.round(event.recording.progress * 100)))
        : null;
    work.set(key, {
      id: event.id,
      title: event.title,
      category: event.category,
      kind,
      status: event.status,
      phase: event.phase,
      progress,
      href: event.recording?.scheduledJobId
        ? `/biblioteca/${event.recording.scheduledJobId}`
        : "/programacion",
    });
  }
  for (const job of jobs) {
    if (job.isTerminal || linkedJobs.has(job.jobId)) continue;
    work.set(`library:${job.jobId}`, {
      id: job.jobId,
      title: job.title,
      category: job.category,
      kind: "pipeline",
      status: job.stage === "pending" ? "queued" : "active",
      phase: job.stage,
      progress: null,
      href: `/biblioteca/${job.jobId}`,
    });
  }
  return [...work.values()].sort(
    (a, b) =>
      Number(a.status === "queued") - Number(b.status === "queued") || a.id.localeCompare(b.id),
  );
}

/** Include overdue executable tasks. Editorial proposals are labelled separately.
 * Summary publications fill gaps when the queue endpoint is temporarily unavailable. */
export function upcomingWork(
  events: AgendaEvent[],
  publications: UpcomingPublication[],
  now = Date.now(),
): AgendaEvent[] {
  const result = new Map<string, AgendaEvent>();
  for (const event of events) {
    if (!event.at || !Number.isFinite(Date.parse(event.at))) continue;
    if (
      event.status !== "scheduled" &&
      !(event.status === "planned" && Date.parse(event.at) >= now)
    )
      continue;
    result.set(event.id, event);
  }
  for (const item of publications) {
    const id = `publication:${item.entryId}`;
    if (result.has(id) || events.some((e) => e.id === id)) continue;
    if (!Number.isFinite(Date.parse(item.scheduledAt))) continue;
    result.set(id, {
      id,
      kind: "publication",
      title: item.title,
      category: null,
      at: item.scheduledAt,
      status: "scheduled",
      phase: null,
      videoId: null,
      error: null,
    });
  }
  return [...result.values()].sort(
    (a, b) => Date.parse(a.at as string) - Date.parse(b.at as string) || a.id.localeCompare(b.id),
  );
}

/** Keep the latest attempt for each video; library alerts already cover linked failures. */
export function operationFailures(events: AgendaEvent[], alerts: DashboardAlert[]): AgendaEvent[] {
  const latest = new Map<string, AgendaEvent>();
  const instant = (event: AgendaEvent) =>
    Date.parse(event.production?.createdAt || event.at || "") || 0;
  for (const event of events) {
    if (event.kind === "publication" || (event.kind === "plan" && !event.production)) continue;
    const key = event.videoId || event.id;
    const previous = latest.get(key);
    if (!previous || instant(event) >= instant(previous)) latest.set(key, event);
  }
  return [...latest.values()].filter(
    (event) =>
      event.status === "failed" &&
      !alerts.some((alert) => alert.jobId && alert.jobId === event.recording?.scheduledJobId),
  );
}

export function timestamp(
  value: string | number | null,
  locale: string,
  zone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (value === null) return "—";
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...options,
  }).format(date);
}
