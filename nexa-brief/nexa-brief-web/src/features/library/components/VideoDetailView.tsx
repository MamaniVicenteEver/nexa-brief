"use client";

import { ExternalLink, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useJobStatus } from "@/features/create-video/hooks/useJobStatus";
import { STAGE_LABEL_KEY } from "@/features/create-video/stage";
import { PublishNowDialog, type QueueEntry, useQueueEntries } from "@/features/schedule";
import { usePublishNowMutation } from "@/features/schedule/hooks/usePublishNowMutation";
import { useJobPublications } from "../hooks/useJobDeletion";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { DeleteVideoDialog } from "./DeleteVideoDialog";
import { GenerationTimeCard } from "./GenerationTimeCard";

const PLATFORM_LABEL: Record<QueueEntry["platform"], string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
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
  const tQueue = useTranslations("schedule.queue");
  const { data: job, isLoading, isError } = useJobStatus(jobId);
  const { data: queueEntries } = useQueueEntries({ jobId });
  const {
    data: publications,
    isLoading: publicationsLoading,
    isError: publicationsError,
  } = useJobPublications(jobId, true);
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [format, setFormat] = useState<"youtube" | "reels">("youtube");
  const [retryError, setRetryError] = useState("");
  const retry = usePublishNowMutation();

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-22 pb-16 sm:px-6 lg:px-8">
        <div className="h-7 w-2/3 animate-pulse rounded-full bg-nb-bg-2" />
        <div className="mt-5 aspect-video w-full animate-pulse rounded-2xl bg-nb-bg-2" />
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-22 pb-16 sm:px-6 lg:px-8">
        <BackLink label={t("detail.back")} />
        <p className="text-[13px] text-nb-mute">{t("detail.notFound")}</p>
      </div>
    );
  }

  const desktopUrl = job.files.find((f) => f.format === "youtube")?.url ?? null;
  const mobileUrl = job.files.find((f) => f.format === "reels")?.url ?? null;
  const videoUrl = format === "reels" && mobileUrl ? mobileUrl : (desktopUrl ?? mobileUrl);
  const publishedAccounts = new Set(
    (queueEntries ?? [])
      .filter((entry) => entry.status === "published")
      .map((entry) => `${entry.platform}:${entry.accountAlias}`),
  );
  const activeAccounts = new Set(
    (queueEntries ?? [])
      .filter((entry) => entry.status === "queued" || entry.status === "publishing")
      .map((entry) => `${entry.platform}:${entry.accountAlias}`),
  );
  const latestAttempt = new Map<string, string>();
  for (const entry of [...(queueEntries ?? [])].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    latestAttempt.set(`${entry.platform}:${entry.accountAlias}`, entry.entryId);
  }
  const statusClasses = cn(
    "rounded-2xl border p-5",
    job.stage === "failed" && "border-destructive/30 bg-destructive/5",
    job.isSuccess && "border-nb-green/40 bg-nb-green/5",
    !job.isSuccess && job.stage !== "failed" && "border-nb-accent-amber/40 bg-nb-accent-amber/10",
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-22 pb-16 sm:px-6 lg:px-8">
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

      <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.9fr)]">
        {videoUrl ? (
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              {desktopUrl && (
                <button
                  type="button"
                  onClick={() => setFormat("youtube")}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    format === "youtube" ? "border-nb-ink bg-nb-ink text-white" : "border-nb-line",
                  )}
                >
                  {t("detail.desktopFormat")}
                </button>
              )}
              {mobileUrl && (
                <button
                  type="button"
                  onClick={() => setFormat("reels")}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    format === "reels" ? "border-nb-ink bg-nb-ink text-white" : "border-nb-line",
                  )}
                >
                  {t("detail.mobileFormat")}
                </button>
              )}
            </div>
            <div className="overflow-hidden rounded-2xl bg-black">
              {/** biome-ignore lint/a11y/useMediaCaption: video generado por el pipeline, sin pista de subtítulos disponible */}
              <video
                key={videoUrl}
                src={videoUrl}
                controls
                playsInline
                className="block w-full max-h-[540px]"
              />
            </div>
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

          {job.isTerminal && (
            <>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-red-600/30 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-600/5"
              >
                <Trash2 className="size-4" />
                {t("deleteDialog.trigger")}
              </button>
              <DeleteVideoDialog
                jobId={job.jobId}
                jobTitle={job.title}
                isPublished={
                  job.stage === "published" ||
                  (queueEntries ?? []).some((e) => e.status === "published")
                }
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                onDeleted={() => router.push("/biblioteca")}
              />
              <section className="rounded-2xl bg-nb-surface p-4">
                <p className="mb-3 text-[11px] font-semibold tracking-[0.05em] text-nb-mute uppercase">
                  {t("detail.publishedTo")}
                </p>
                {publicationsLoading ? (
                  <p className="text-[13px] text-nb-mute">{t("detail.publicationsLoading")}</p>
                ) : publicationsError ? (
                  <p className="text-[13px] text-red-600">{t("detail.publicationsError")}</p>
                ) : publications && publications.length > 0 ? (
                  <ul className="space-y-3">
                    {publications.map((publication) => (
                      <li
                        key={[
                          publication.platform,
                          publication.accountAlias,
                          publication.postId,
                        ].join(":")}
                        className="border-b border-nb-line pb-3 last:border-0 last:pb-0"
                      >
                        <p className="text-xs font-semibold text-nb-ink">
                          {PLATFORM_LABEL[publication.platform]} · {publication.accountAlias}
                        </p>
                        {publication.url ? (
                          <a
                            href={publication.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block break-all text-xs text-nb-ink-soft underline underline-offset-2"
                          >
                            {publication.url}
                          </a>
                        ) : (
                          <p className="mt-1 break-all text-xs text-nb-mute">
                            {t("detail.publicationUrlUnavailable")} · {publication.postId}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-nb-mute">{t("detail.noPublishes")}</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
        <GenerationTimeCard
          jobId={job.jobId}
          createdAt={job.createdAt}
          generationSeconds={job.generationSeconds}
        />

        {job.summary && (
          <div className="flex flex-col gap-3 rounded-2xl bg-nb-surface p-5">
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
            {Object.entries(job.summary.platformCopies)
              .filter(([platform]) => platform !== "youtube")
              .map(([platform, copy]) => (
                <div key={platform}>
                  <p className="text-[11px] font-semibold tracking-[0.05em] text-nb-mute uppercase">
                    {platform}
                  </p>
                  <p className="mt-1 text-[13.5px] font-semibold text-nb-ink">{copy.title}</p>
                  {copy.description && (
                    <p className="mt-1 text-[13px] whitespace-pre-line text-nb-ink-soft">
                      {copy.description}
                    </p>
                  )}
                </div>
              ))}
            {job.summary.pinnedComment && (
              <div>
                <p className="text-[11px] font-semibold tracking-[0.05em] text-nb-mute uppercase">
                  {t("detail.youtubeComment")}
                </p>
                <p className="mt-1 text-[13px] whitespace-pre-line text-nb-ink">
                  {job.summary.pinnedComment}
                </p>
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
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.05em] text-nb-mute uppercase">
          {t("detail.publicationActivity")}
        </p>
        {queueEntries && queueEntries.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
            {queueEntries.map((entry) => (
              <div
                key={entry.entryId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-nb-surface px-4 py-3 text-[12.5px]"
              >
                <span className="font-semibold text-nb-ink">
                  {PLATFORM_LABEL[entry.platform]} · {entry.accountAlias}
                </span>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-nb-mute",
                      entry.status === "published" && "text-nb-green-dark",
                      entry.status === "failed" && "text-red-600",
                    )}
                  >
                    {tQueue(`statusLabels.${entry.status}`)}
                    {entry.processedAt && ` · ${new Date(entry.processedAt).toLocaleString()}`}
                  </span>
                  {entry.url && (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t("detail.openPublication")}
                      className="text-nb-ink"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                  {entry.status === "failed" &&
                    !publishedAccounts.has(`${entry.platform}:${entry.accountAlias}`) &&
                    !activeAccounts.has(`${entry.platform}:${entry.accountAlias}`) &&
                    latestAttempt.get(`${entry.platform}:${entry.accountAlias}`) ===
                      entry.entryId && (
                      <button
                        type="button"
                        disabled={retry.isPending}
                        onClick={async () => {
                          setRetryError("");
                          try {
                            await retry.mutateAsync({
                              jobId,
                              platform: entry.platform,
                              accountAlias: entry.accountAlias,
                            });
                          } catch (error) {
                            setRetryError(error instanceof Error ? error.message : String(error));
                          }
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-nb-ink underline disabled:opacity-50"
                      >
                        <RotateCcw className="size-3.5" /> {t("detail.retryPublication")}
                      </button>
                    )}
                </div>
                {entry.error && entry.status === "failed" && (
                  <p className="w-full text-[11px] text-red-600">{entry.error}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-nb-mute">{t("detail.noPublishes")}</p>
        )}
        {retryError && <p className="mt-2 text-xs text-red-600">{retryError}</p>}
      </div>
    </div>
  );
}
