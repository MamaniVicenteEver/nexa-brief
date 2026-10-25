"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ExplainerJob } from "@/features/explainer/types";
import { RecordingProgress } from "@/features/explainer/components/RecordingProgress";

export function ExplainerRecordingCard({
  job,
  categoryLabel,
}: {
  job: ExplainerJob;
  categoryLabel: string;
}) {
  const t = useTranslations("library");
  const active = job.state !== "failed";
  const title = job.title || t("recordingCard.titleFallback", { videoId: job.videoId });

  return (
    <article className="group/card flex flex-col overflow-hidden rounded-[20px] bg-nb-surface shadow-[0_18px_34px_-18px_rgba(40,30,10,0.22),0_6px_14px_-6px_rgba(40,30,10,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_40px_-18px_rgba(40,30,10,0.3),0_8px_16px_-6px_rgba(40,30,10,0.1)]">
      <div className="relative aspect-video w-full overflow-hidden bg-nb-ink">
        {job.posterUrl ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${job.posterUrl}")` }}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-nb-ink via-nb-ink-soft to-nb-ink">
            {active ? (
              <Loader2 className="size-8 animate-spin text-nb-accent-amber" />
            ) : (
              <AlertTriangle className="size-8 text-nb-accent-coral" />
            )}
          </div>
        )}
        <span
          className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${active ? "bg-nb-accent-amber text-nb-ink" : "bg-nb-accent-coral text-white"}`}
        >
          {active ? <Loader2 className="size-3 animate-spin" /> : <AlertTriangle className="size-3" />}
          {t(active ? "recordingCard.recording" : "recordingCard.failed")}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-4.5 pt-3.5 pb-4">
        <span className="truncate text-[11px] font-semibold tracking-[0.04em] text-nb-mute uppercase">
          {categoryLabel}
        </span>
        <h2 className="line-clamp-2 min-h-[2.6em] text-[15px] leading-[1.3] font-bold tracking-[-0.015em] text-nb-ink">
          {title}
        </h2>
        <RecordingProgress job={job} />
        {job.state === "failed" && job.error && (
          <p className="mt-1 break-words text-[12px] leading-[1.45] text-nb-accent-coral">
            {job.error}
          </p>
        )}
      </div>
    </article>
  );
}
