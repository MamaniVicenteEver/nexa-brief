"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Film,
  Info,
  Loader2,
  Play,
  Send,
  Timer,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useChannels } from "@/features/channels/hooks/useChannels";
import { STAGE_LABEL_KEY } from "@/features/create-video/stage";
import { PublishNowDialog, type QueueEntry } from "@/features/schedule";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { MediaPlayerModal } from "@/shared/components/media/MediaPlayerModal";
import {
  canDelete,
  formatDuration,
  formatElapsed,
  hasRenderedVideo,
  jobFileUrl,
  type LibraryStatus,
  type LibraryVideo,
  stageProgress,
} from "../library-status";
import { DeleteVideoDialog } from "./DeleteVideoDialog";
import { VideoPlayerSidebar } from "./player-sidebar/VideoPlayerSidebar";

const PLATFORM_LABEL: Record<QueueEntry["platform"], string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
};

const STATUS_STYLE: Record<LibraryStatus, { className: string; Icon: typeof Clock3 }> = {
  ready: { className: "bg-white/90 text-nb-ink", Icon: CheckCircle2 },
  scheduled: { className: "bg-nb-accent-gold text-nb-ink", Icon: CalendarClock },
  published: { className: "bg-nb-green text-nb-ink", Icon: CheckCircle2 },
  processing: { className: "bg-nb-accent-amber text-nb-ink", Icon: Loader2 },
  failed: { className: "bg-nb-accent-coral text-white", Icon: AlertTriangle },
};

export function VideoCard({ video }: { video: LibraryVideo }) {
  const t = useTranslations("library");
  const { job, status, categoryLabel } = video;
  const [playerOpen, setPlayerOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const rendered = hasRenderedVideo(status);
  const canPublish = status === "ready" || status === "scheduled" || status === "published";
  const detailHref = `/biblioteca/${job.jobId}`;

  const publishButton = (variant: "primary" | "secondary", className?: string) => (
    <PublishNowDialog jobId={job.jobId} jobTitle={job.title}>
      <button
        type="button"
        title={status === "published" ? t("videoCard.publishAgain") : undefined}
        aria-label={status === "published" ? t("videoCard.publishAgain") : undefined}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap",
          variant === "primary" ? "nb-btn-pill" : "nb-btn-secondary",
          className,
        )}
      >
        <Send className="size-3.5" />
        {/* publicado: el texto corto deja lugar al botón de copiar; el completo va en el tooltip */}
        {t("videoCard.publishNow")}
      </button>
    </PublishNowDialog>
  );

  return (
    <article className="group/card flex flex-col overflow-hidden rounded-[20px] bg-nb-surface shadow-[0_18px_34px_-18px_rgba(40,30,10,0.22),0_6px_14px_-6px_rgba(40,30,10,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_26px_40px_-18px_rgba(40,30,10,0.3),0_8px_16px_-6px_rgba(40,30,10,0.1)]">
      <div className="relative aspect-video w-full overflow-hidden bg-nb-ink">
        {rendered ? (
          <MediaPlayerModal
            open={playerOpen}
            onOpenChange={setPlayerOpen}
            title={job.title}
            source={{
              kind: "video",
              desktopUrl: jobFileUrl(job.jobId, "youtube"),
              mobileUrl: jobFileUrl(job.jobId, "reels"),
            }}
            actions={canPublish ? publishButton("secondary", "px-3 py-1.5") : undefined}
            // Textos, publicaciones e info técnica en el panel lateral: el modal no navega.
            sidebar={
              <VideoPlayerSidebar
                jobId={job.jobId}
                jobTitle={job.title}
                categoryLabel={categoryLabel}
                canPublish={canPublish}
              />
            }
            sidebarToggleLabel={t("playerSidebar.toggle")}
            trigger={
              <button
                type="button"
                aria-label={`${t("videoCard.playButton")}: ${job.title}`}
                className="absolute inset-0 cursor-pointer"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onFocus={() => setHovered(true)}
                onBlur={() => setHovered(false)}
              >
                <HoverPreview
                  src={jobFileUrl(job.jobId, "youtube")}
                  active={hovered && !playerOpen}
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover/card:bg-black/25">
                  <span className="flex size-12 scale-90 items-center justify-center rounded-full bg-white/90 text-nb-ink opacity-0 shadow-lg transition-all duration-300 group-hover/card:scale-100 group-hover/card:opacity-100">
                    <Play className="ml-0.5 size-5 fill-current" />
                  </span>
                </span>
              </button>
            }
          />
        ) : (
          <PlaceholderThumb
            status={status}
            stageLabel={t(`stages.${STAGE_LABEL_KEY[job.stage]}`)}
            progress={stageProgress(job.stage)}
          />
        )}

        <StatusBadge status={status} label={t(`status.${status}`)} />
        {job.durationSeconds !== null && (
          <span className="pointer-events-none absolute right-2.5 bottom-2.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">
            {formatDuration(job.durationSeconds)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-4.5 pt-3.5 pb-4">
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-nb-mute">
          <span className="min-w-0 truncate tracking-[0.04em] uppercase" title={categoryLabel}>
            {categoryLabel}
          </span>
          <time dateTime={job.updatedAt} className="shrink-0">
            {new Date(job.updatedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </time>
        </div>

        <Link
          href={detailHref}
          className="line-clamp-2 min-h-[2.6em] text-[15px] leading-[1.3] font-bold tracking-[-0.015em] text-nb-ink hover:underline"
        >
          {job.title}
        </Link>

        {job.generationSeconds !== null && (
          <span
            className="-mt-1 inline-flex items-center gap-1 text-[11.5px] text-nb-mute"
            title={t("videoCard.generatedInHint")}
          >
            <Timer className="size-3.5" />
            {t("videoCard.generatedIn", { time: formatElapsed(job.generationSeconds) })}
          </span>
        )}

        <CardMeta video={video} />

        <div className="mt-auto flex items-center gap-2 border-t border-nb-line pt-3">
          {canPublish ? (
            publishButton(status === "published" ? "secondary" : "primary", "flex-1")
          ) : (
            <span className="flex-1 truncate text-[12px] text-nb-mute">
              {status === "failed" ? t("status.failed") : t(`stages.${STAGE_LABEL_KEY[job.stage]}`)}
            </span>
          )}
          <CopyUrlsButton video={video} />
          <Link
            href={detailHref}
            aria-label={t("videoCard.details")}
            title={t("videoCard.details")}
            className="nb-btn-secondary flex size-8.5 shrink-0 items-center justify-center rounded-full"
          >
            <Info className="size-4" />
          </Link>
          {canDelete(video) && (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              aria-label={t("deleteDialog.trigger")}
              title={t("deleteDialog.trigger")}
              className="nb-btn-secondary flex size-8.5 shrink-0 items-center justify-center rounded-full text-nb-mute transition-colors hover:text-red-600"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>
      <DeleteVideoDialog
        jobId={job.jobId}
        jobTitle={job.title}
        isPublished={status === "published"}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </article>
  );
}

/** Copia todas las URL publicadas del video, una por línea: «YouTube: https://…». */
function CopyUrlsButton({ video }: { video: LibraryVideo }) {
  const t = useTranslations("library");
  const [copied, setCopied] = useState(false);
  const withUrl = video.published.filter((entry) => entry.url);
  if (withUrl.length === 0) return null;

  const copy = async () => {
    // misma red en varias cuentas: se agrega la cuenta para distinguirlas
    const repeated = (p: QueueEntry["platform"]) => withUrl.filter((e) => e.platform === p).length > 1;
    const text = withUrl
      .map((e) => `${PLATFORM_LABEL[e.platform]}${repeated(e.platform) ? ` (${e.accountAlias})` : ""}: ${e.url}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const label = copied ? t("videoCard.copiedUrls") : t("videoCard.copyUrls");
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      className="nb-btn-secondary flex size-8.5 shrink-0 items-center justify-center rounded-full"
    >
      {copied ? <Check className="size-4 text-nb-green-dark" /> : <Copy className="size-4" />}
    </button>
  );
}

function CardMeta({ video }: { video: LibraryVideo }) {
  const t = useTranslations("library");
  const { data: channels } = useChannels();
  const { status, published, scheduled } = video;
  const channelName = (entry: QueueEntry) =>
    channels?.find((c) => c.platform === entry.platform && c.alias === entry.accountAlias)?.name ||
    entry.accountAlias;

  if (status === "failed") {
    return (
      <p className="text-[12px] leading-[1.45] text-nb-accent-coral">{t("videoCard.failedHint")}</p>
    );
  }

  const uploading = scheduled.filter((e) => e.status === "publishing" || e.source === "immediate");
  if (published.length > 0 || uploading.length > 0) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {published.map((entry) => {
          const label = `${PLATFORM_LABEL[entry.platform]} · ${entry.accountAlias}`;
          const className =
            "inline-flex max-w-full items-center gap-1 rounded-full bg-nb-green/25 px-2.5 py-1 text-[11px] font-semibold text-nb-green-dark";
          return entry.url ? (
            <a
              key={entry.entryId}
              href={entry.url}
              target="_blank"
              rel="noreferrer"
              title={t("videoCard.openPost")}
              className={cn(className, "hover:bg-nb-green/40")}
            >
              <span className="truncate">{label}</span>
              <ArrowUpRight className="size-3 shrink-0" />
            </a>
          ) : (
            <span key={entry.entryId} className={className}>
              <span className="truncate">{label}</span>
            </span>
          );
        })}
        {uploading.map((entry) => {
          const label = `${PLATFORM_LABEL[entry.platform]} · ${t("videoCard.publishingNow")} · ${channelName(entry)}`;
          return (
            <span
              key={entry.entryId}
              title={label}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-nb-accent-amber/25 px-2.5 py-1 text-[11px] font-semibold text-nb-ink-soft"
            >
              <Loader2 className="size-3 shrink-0 animate-spin" />
              <span className="truncate">{label}</span>
            </span>
          );
        })}
      </div>
    );
  }

  if (scheduled.length > 0) {
    const next = scheduled
      .map((e) => e.scheduledAt)
      .filter((d): d is string => d !== null)
      .sort()[0];
    return (
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-nb-accent-gold/30 px-2.5 py-1 text-[11px] font-semibold text-nb-ink-soft">
          <CalendarClock className="size-3" />
          {next
            ? t("videoCard.scheduledFor", {
                date: new Date(next).toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })
            : t("status.scheduled")}
        </span>
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="flex">
        <span className="inline-flex items-center gap-1 rounded-full bg-nb-bg-2 px-2.5 py-1 text-[11px] font-semibold text-nb-ink-soft">
          <Clock3 className="size-3" />
          {t("videoCard.pendingPublish")}
        </span>
      </div>
    );
  }

  return null;
}

function StatusBadge({ status, label }: { status: LibraryStatus; label: string }) {
  const { className, Icon } = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm",
        className,
      )}
    >
      <Icon className={cn("size-3", status === "processing" && "animate-spin")} />
      {label}
    </span>
  );
}

/** Primer frame como miniatura (el backend no genera thumbnail todavía) y
 * reproducción muda al pasar el mouse, igual que las cards de Plantillas. */
function HoverPreview({ src, active }: { src: string; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      void video.play().catch(() => {});
      return;
    }
    video.pause();
    if (video.readyState > 0) video.currentTime = 1;
  }, [active]);

  if (failed) return <FilmFallback />;

  return (
    <video
      ref={videoRef}
      src={`${src}#t=1`}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
      tabIndex={-1}
      onError={() => setFailed(true)}
      className="size-full object-cover transition-transform duration-700 group-hover/card:scale-[1.04]"
    />
  );
}

function FilmFallback() {
  return (
    <div className="flex size-full items-center justify-center bg-gradient-to-br from-nb-ink to-nb-ink-soft text-white/40">
      <Film className="size-8" />
    </div>
  );
}

function PlaceholderThumb({
  status,
  stageLabel,
  progress,
}: {
  status: LibraryStatus;
  stageLabel: string;
  progress: number;
}) {
  if (status === "failed") {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#3a1d17] to-nb-ink text-nb-accent-coral">
        <AlertTriangle className="size-8" />
      </div>
    );
  }
  return (
    <div className="relative flex size-full flex-col items-center justify-center gap-3 overflow-hidden bg-gradient-to-br from-nb-ink via-nb-ink-soft to-nb-ink px-8 text-white/80">
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_30%_40%,rgba(255,170,75,0.18),transparent_60%)]" />
      <Loader2 className="relative size-7 animate-spin text-nb-accent-amber" />
      <span className="relative text-center text-[12px] font-semibold">{stageLabel}</span>
      <div className="relative h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-nb-accent-amber transition-[width] duration-700"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
