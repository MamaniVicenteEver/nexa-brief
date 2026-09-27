"use client";

import { formatRelativeTime } from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";
import { useHistory } from "../hooks/useHistory";
import type { HistoryEvent } from "../types";
import { stageLabel } from "./stage-labels";

function groupByJob(events: HistoryEvent[]): { jobId: string; events: HistoryEvent[] }[] {
  const order: string[] = [];
  const groups = new Map<string, HistoryEvent[]>();
  for (const event of events) {
    if (!groups.has(event.jobId)) {
      groups.set(event.jobId, []);
      order.push(event.jobId);
    }
    groups.get(event.jobId)?.push(event);
  }
  // `events` ya viene más reciente primero (ver listHistory) — cada grupo
  // conserva ese orden de aparición del job, y sus eventos se muestran
  // cronológicamente (más antiguo primero) dentro de cada línea de tiempo.
  return order.map((jobId) => ({
    jobId,
    events: [...(groups.get(jobId) ?? [])].reverse(),
  }));
}

export function HistorialView() {
  const { data, isLoading, isError, isFetching } = useHistory({ limit: 200 });
  const jobs = groupByJob(data?.events ?? []);

  return (
    <div className="mx-auto max-w-[1000px] px-10 pt-[92px] pb-16">
      <div className="flex items-center justify-between gap-4 pb-4.5">
        <h1 className="font-nb-sans text-[clamp(20px,2.4vw,26px)] font-extrabold tracking-[-0.02em] text-nb-ink">
          Historial
        </h1>
        {isFetching && !isLoading && (
          <span className="text-[11.5px] text-nb-mute">Actualizando…</span>
        )}
      </div>

      {isError && (
        <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] font-medium text-red-600">
          Sin conexión con el servidor — no se pudo cargar el historial. Reintentando
          automáticamente…
        </div>
      )}

      {isLoading ? (
        <p className="text-[13px] text-nb-mute">Cargando historial…</p>
      ) : jobs.length === 0 ? (
        <p className="text-[13px] text-nb-mute">Todavía no hay eventos registrados.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {jobs.map((job) => (
            <JobTimelineCard key={job.jobId} jobId={job.jobId} events={job.events} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobTimelineCard({ jobId, events }: { jobId: string; events: HistoryEvent[] }) {
  const last = events[events.length - 1];

  return (
    <div className="rounded-2xl border border-nb-line px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3 pb-3">
        <span className="font-mono text-[12px] text-nb-mute">{jobId}</span>
        <span className="text-[11px] text-nb-mute">{formatRelativeTime(last.createdAt)}</span>
      </div>
      <ol className="flex flex-wrap gap-1.5">
        {events.map((event) => (
          <li
            key={event.eventId}
            title={event.message ?? undefined}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11.5px] font-medium",
              event.status === "failed"
                ? "border-red-500/30 bg-red-500/5 text-red-600"
                : "border-nb-line bg-nb-surface text-nb-ink-soft",
            )}
          >
            {stageLabel(event.stage)}
          </li>
        ))}
      </ol>
    </div>
  );
}
