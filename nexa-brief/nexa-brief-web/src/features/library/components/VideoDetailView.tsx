"use client";

import { useTranslations } from "next-intl";
import { useJobStatus } from "@/features/create-video/hooks/useJobStatus";
import { STAGE_LABEL_KEY } from "@/features/create-video/stage";
import { PublishNowDialog, type QueueEntry, useQueueEntries } from "@/features/schedule";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

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

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/biblioteca"
      className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-nb-mute hover:text-nb-ink"
    >
      ← {label}
    </Link>
  );
}

export function VideoDetailView({ jobId }: { jobId: string }) {
  const t = useTranslations("library");
  const { data: job, isLoading, isError } = useJobStatus(jobId);
  const { data: queueEntries } = useQueueEntries({ jobId });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[900px] px-10 pt-[92px] pb-16">
        <p className="text-[13px] text-nb-mute">{t("emptyState")}</p>
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="mx-auto max-w-[900px] px-10 pt-[92px] pb-16">
        <BackLink label={t("detail.back")} />
        <p className="text-[13px] text-nb-mute">{t("detail.notFound")}</p>
      </div>
    );
  }

  const videoUrl = job.files.find((f) => f.format === "youtube")?.url ?? null;
  const statusClasses = cn(
    "rounded-2xl border p-5",
    job.stage === "failed" && "border-destructive/30 bg-destructive/5",
    job.isSuccess && "border-nb-green/40 bg-nb-green/5",
    !job.isSuccess && job.stage !== "failed" && "border-nb-accent-amber/40 bg-nb-accent-amber/10",
  );

  return (
    <div className="mx-auto max-w-[900px] px-10 pt-[92px] pb-16">
      <BackLink label={t("detail.back")} />

      <h1 className="font-nb-sans text-[clamp(20px,2.4vw,26px)] font-extrabold tracking-[-0.02em] text-nb-ink">
        {job.title}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-nb-bg-2 px-3.5 py-1.5 text-xs font-semibold text-nb-ink-soft">
          {job.category}
        </span>
        {job.durationSeconds !== null && (
          <span className="text-[12.5px] text-nb-mute">{formatDuration(job.durationSeconds)}</span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-[1.4fr_1fr]">
        {videoUrl ? (
          <div className="overflow-hidden rounded-2xl bg-black">
            {/** biome-ignore lint/a11y/useMediaCaption: video generado por el pipeline, sin pista de subtítulos disponible */}
            <video src={videoUrl} controls playsInline className="block w-full" />
          </div>
        ) : (
          <div className={statusClasses}>
            <p className="text-sm font-semibold text-nb-ink">
              {job.stage === "failed" ? t("detail.notFound") : t("detail.generating")}
            </p>
            <p className="mt-1 text-xs text-nb-mute">{t(`stages.${STAGE_LABEL_KEY[job.stage]}`)}</p>
            {job.errors.map((err) => (
              <p key={err} className="mt-1 text-xs text-destructive/80">
                {err}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className={statusClasses}>
            <p className="text-sm font-semibold text-nb-ink">
              {t(`stages.${STAGE_LABEL_KEY[job.stage]}`)}
            </p>
            <p className="mt-1.5 text-xs text-nb-mute">
              {t("detail.createdAt")}: {new Date(job.createdAt).toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-nb-mute">
              {t("detail.updatedAt")}: {new Date(job.updatedAt).toLocaleString()}
            </p>
          </div>

          {job.isSuccess && (
            <PublishNowDialog jobId={job.jobId} jobTitle={job.title}>
              <button
                type="button"
                className="nb-btn-pill w-full rounded-full px-4 py-2.5 text-sm font-semibold"
              >
                {t("videoCard.publishNow")}
              </button>
            </PublishNowDialog>
          )}
        </div>
      </div>

      {job.summary && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-nb-surface p-5">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.05em] text-nb-mute uppercase">
              {t("detail.description")}
            </p>
            <p className="mt-1 text-[13.5px] whitespace-pre-line text-nb-ink">
              {job.summary.youtubeDescription}
            </p>
          </div>
          {job.summary.youtubeTags.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold tracking-[0.05em] text-nb-mute uppercase">
                {t("detail.tags")}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {job.summary.youtubeTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-nb-bg-2 px-2.5 py-1 text-[11.5px] text-nb-ink-soft"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {job.summary.tiktokCaption && (
            <div>
              <p className="text-[11px] font-semibold tracking-[0.05em] text-nb-mute uppercase">
                {t("detail.tiktokCaption")}
              </p>
              <p className="mt-1 text-[13.5px] text-nb-ink">{job.summary.tiktokCaption}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.05em] text-nb-mute uppercase">
          {t("detail.publishedTo")}
        </p>
        {queueEntries && queueEntries.length > 0 ? (
          <div className="flex flex-col gap-2">
            {queueEntries.map((entry) => (
              <div
                key={entry.entryId}
                className="flex items-center justify-between rounded-2xl bg-nb-surface px-4 py-3 text-[12.5px]"
              >
                <span className="font-semibold text-nb-ink">
                  {PLATFORM_LABEL[entry.platform]} · {entry.accountAlias}
                </span>
                <span className="text-nb-mute">
                  {entry.status}
                  {entry.processedAt && ` · ${new Date(entry.processedAt).toLocaleString()}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-nb-mute">{t("detail.noPublishes")}</p>
        )}
      </div>
    </div>
  );
}
