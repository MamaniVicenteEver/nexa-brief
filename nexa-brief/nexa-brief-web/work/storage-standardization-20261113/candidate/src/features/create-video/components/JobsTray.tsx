"use client";

import { ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { RecordingTrayCard } from "@/features/explainer/components/RecordingTrayCard";
import { useRecordingTrayStore } from "@/features/explainer/store/recording-tray-store";
import { cn } from "@/lib/utils";
import { useJobsTrayStore } from "@/shared/store";
import { useTrackedJobsSummary } from "../hooks/useTrackedJobsSummary";
import { useDraftsTrayStore } from "../store/drafts-tray-store";
import { DraftTrayCard } from "./DraftTrayCard";
import { JobProgressCard } from "./JobProgressCard";

/** Fixed bottom-right stack of in-flight/recent job cards — mounted once in
 * `(admin)/layout.tsx`, so it stays visible across every admin page instead
 * of disappearing the moment you navigate away from wherever you submitted
 * the batch. Both submission entry points (CreateVideoForm and
 * TemplateRecordButton) push into the same `useJobsTrayStore`. Videos de
 * Crear video que todavía se están previsualizando como draft (sin job_id)
 * van arriba, desde `useDraftsTrayStore`, hasta que empiezan a grabarse. */
export function JobsTray() {
  const t = useTranslations("createVideo.tray");
  const tFlow = useTranslations("createFlow.tray");
  const [hasHydrated, setHasHydrated] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const jobs = useJobsTrayStore((state) => state.jobs);
  const removeJobs = useJobsTrayStore((state) => state.removeJobs);
  const drafts = useDraftsTrayStore((state) => state.drafts);
  const recordings = useRecordingTrayStore((state) => state.recordings);
  const removeDraft = useDraftsTrayStore((state) => state.removeDraft);
  const summary = useTrackedJobsSummary(jobs.map((j) => j.jobId));

  useEffect(() => {
    useJobsTrayStore.persist.rehydrate();
    useDraftsTrayStore.persist.rehydrate();
    useRecordingTrayStore.persist.rehydrate();
    setHasHydrated(true);
  }, []);

  if (!hasHydrated || (jobs.length === 0 && drafts.length === 0 && recordings.length === 0))
    return null;

  const finished = [...summary.done, ...summary.failed];
  const parts = [
    drafts.length && tFlow("preparingCount", { count: drafts.length }),
    recordings.length && `${recordings.length} Plantillas`,
    summary.running.length && t("running", { count: summary.running.length }),
    summary.queued.length && t("queued", { count: summary.queued.length }),
    summary.done.length && t("done", { count: summary.done.length }),
    summary.failed.length && t("failed", { count: summary.failed.length }),
  ].filter(Boolean);

  return (
    <section
      aria-label={t("title")}
      className="fixed right-4 bottom-4 z-40 flex max-h-[75vh] w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[20px] border border-nb-line bg-nb-bg/95 shadow-[0_24px_48px_-18px_rgba(40,30,10,0.4)] backdrop-blur"
    >
      <header className="flex items-center gap-2 border-b border-nb-line px-4 py-3">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {(summary.running.length > 0 || drafts.length > 0) && (
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-nb-green-dark" />
          )}
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-nb-ink">{t("title")}</span>
            <span className="block text-[11.5px] leading-snug text-nb-mute">
              {parts.join(" · ")}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "ml-auto size-4 shrink-0 text-nb-mute transition-transform",
              collapsed && "rotate-180",
            )}
          />
        </button>
        {finished.length > 0 && (
          <button
            type="button"
            onClick={() => removeJobs(finished)}
            className="shrink-0 rounded-full px-2 py-1 text-[11.5px] font-semibold text-nb-ink-soft hover:bg-nb-ink/[0.06]"
          >
            {t("clearFinished")}
          </button>
        )}
      </header>

      {!collapsed && (
        <div className="flex flex-col gap-2 overflow-y-auto p-3">
          {[...drafts].reverse().map((tracked) => (
            <DraftTrayCard
              key={tracked.draftId}
              tracked={tracked}
              actions={
                <button
                  type="button"
                  onClick={() => removeDraft(tracked.draftId)}
                  aria-label={t("dismiss")}
                  className="grid size-6 place-items-center rounded-full text-nb-mute hover:bg-nb-ink/[0.08] hover:text-nb-ink"
                >
                  <X className="size-3.5" />
                </button>
              }
            />
          ))}
          {[...recordings].reverse().map((recording) => (
            <RecordingTrayCard key={recording.jobId} tracked={recording} />
          ))}
          {[...jobs].reverse().map((job) => (
            <JobProgressCard
              key={job.jobId}
              job={{ jobId: job.jobId, category: job.category, stage: "pending" }}
              label={job.label}
              actions={
                <button
                  type="button"
                  onClick={() => removeJobs([job.jobId])}
                  aria-label={t("dismiss")}
                  className="grid size-6 place-items-center rounded-full text-nb-mute hover:bg-nb-ink/[0.08] hover:text-nb-ink"
                >
                  <X className="size-3.5" />
                </button>
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
