"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { JobListItem } from "@/features/create-video/types";
import { PublishNowDialog, type QueueEntry } from "@/features/schedule";
import { Link } from "@/i18n/navigation";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { VideoPlayerDialog } from "@/shared/components/media/VideoPlayerDialog";

const PLATFORM_LABEL: Record<QueueEntry["platform"], string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
};

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoCard({
  job,
  mode = "ready",
  publishResults = [],
}: {
  job: JobListItem;
  mode?: "ready" | "published";
  publishResults?: QueueEntry[];
}) {
  const t = useTranslations("library");
  const [playing, setPlaying] = useState(false);
  const videoUrl = resolveApiUrl(`/api/v1/videos/jobs/${job.jobId}/file/youtube`);

  return (
    <>
      <div className="rounded-[20px] bg-nb-surface px-5.5 py-5 shadow-[0_18px_34px_-16px_rgba(40,30,10,0.16),0_6px_14px_-4px_rgba(40,30,10,0.07),inset_0_1px_0_rgba(255,255,255,0.7)]">
        <Link href={`/biblioteca/${job.jobId}`} className="block cursor-pointer">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-[15px] font-bold tracking-[-0.015em] text-nb-ink">{job.title}</h4>
            {mode === "published" && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-nb-green/15 px-2 py-0.5 text-[11px] font-semibold text-nb-green-dark">
                <span className="size-1.5 shrink-0 rounded-full bg-nb-green-dark" />
                {t("videoCard.publishedBadge")}
              </span>
            )}
          </div>
          <div className="mt-1.5 text-[12.5px] leading-[1.5] text-nb-mute">
            {job.durationSeconds !== null
              ? formatDuration(job.durationSeconds)
              : t("videoCard.unknownDuration")}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <span className="rounded-full bg-nb-bg-2 px-3.5 py-1.5 text-xs font-semibold text-nb-ink-soft">
              {job.category}
            </span>
          </div>

          {mode === "published" && publishResults.length > 0 && (
            <div className="mt-2.5 flex flex-col gap-1">
              {publishResults.map((entry) => (
                <div key={entry.entryId} className="text-[11.5px] text-nb-mute">
                  {PLATFORM_LABEL[entry.platform]} · {entry.accountAlias}
                  {entry.processedAt && ` · ${new Date(entry.processedAt).toLocaleDateString()}`}
                </div>
              ))}
            </div>
          )}
        </Link>

        <div className="mt-3.5 flex items-center justify-between border-t border-nb-line pt-3">
          <span className="text-[12.5px] text-nb-mute">
            {new Date(job.updatedAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-2">
            {mode === "ready" && (
              <PublishNowDialog jobId={job.jobId} jobTitle={job.title}>
                <button
                  type="button"
                  className="nb-btn-pill rounded-full px-4 py-2 text-xs font-semibold"
                >
                  {t("videoCard.publishNow")}
                </button>
              </PublishNowDialog>
            )}
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="nb-btn-secondary rounded-full px-4 py-2 text-xs font-semibold"
            >
              {t("videoCard.playButton")}
            </button>
          </div>
        </div>
      </div>
      <VideoPlayerDialog
        videoUrl={playing ? videoUrl : null}
        open={playing}
        onOpenChange={setPlaying}
      />
    </>
  );
}
