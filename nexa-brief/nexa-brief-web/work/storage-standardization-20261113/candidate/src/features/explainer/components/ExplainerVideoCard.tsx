"use client";

import { ArrowLeft, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useVisualStyles } from "@/features/showcase/hooks/useVisualStyles";
import { isReviewDemo } from "@/features/templates/lib/preparation-items";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { cn } from "@/lib/utils";
import { MediaPlayerModal } from "@/shared/components/media/MediaPlayerModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import {
  activeLocalization,
  useLocalizationPreflight,
  useLocalizations,
} from "../hooks/useLocalizations";
import type { ExplainerVideo, ThumbnailPreview } from "../types";
import { ExplainerStudioSidebar } from "./ExplainerStudioSidebar";
import { ThumbnailArtwork } from "./ThumbnailArtwork";

// Segundo que se muestra quieto en la tarjeta (después del título de apertura).
const POSTER_SECOND = 6;
const PLAYER_VOLUME = 0.5;

function withParam(url: string, param: string): string {
  const [base, hash] = url.split("#", 2);
  return `${base}${base.includes("?") ? "&" : "?"}${param}${hash ? `#${hash}` : ""}`;
}

function playableComponentUrl(url: string): string {
  if (typeof window === "undefined") return url;
  const preview = new URL(url, window.location.origin);
  preview.searchParams.delete("t"); // el cuadro congelado solo se usa en la tarjeta lateral
  preview.searchParams.delete("loop");
  preview.searchParams.set("controls", "1");
  preview.searchParams.set("clock", "synthetic");
  return preview.toString();
}

/** Tarjeta de un video del explainer, como las plantillas de NodeMotion: cuadro
 * portada y, al hacer clic, el modal con el reproductor, los textos y las acciones. */
export function ExplainerVideoCard({ video }: { video: ExplainerVideo }) {
  const t = useTranslations("templates");
  const tx = useTranslations("explainer");
  const playerText = useTranslations("mediaPlayer");
  const narrativeLabel = video.narrativeLabel;
  const [open, setOpen] = useState(false);
  const localizations = useLocalizations(video.videoId, open && !video.scriptReviewRequired);
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);
  // Reinicia la selección al abrir otro video o volver a abrir el modal.
  // biome-ignore lint/correctness/useExhaustiveDependencies: los cambios de identidad y apertura son los disparadores.
  useEffect(() => {
    setSelectedLocale(null);
  }, [video.videoId, open]);
  const data = localizations.data;
  const selected = data?.locales.find(
    (item) => item.locale === (selectedLocale ?? data.default_locale),
  );
  const translated = selected && !selected.is_original;
  const job = localizations.jobs.find((item) => item.locale === selected?.locale);
  const status = job?.status === "running" ? "generating" : (job?.status ?? selected?.status);
  const playable = !translated || Boolean(selected.preview_url);
  const preflight = useLocalizationPreflight(
    video.videoId,
    translated ? selected.locale : undefined,
    open && Boolean(translated && !playable && (status === "missing" || status === "failed")),
  );
  const creationLock = useRef(false);
  const syncingPreflight = useRef("");
  useEffect(() => {
    const check = preflight?.data;
    if (!open || !translated || !check || preflight?.isFetching) return;
    const identity = `${selected.locale}:${check.next_action}:${check.job_id ?? ""}:${check.revision ?? ""}`;
    if (syncingPreflight.current === identity) return;
    if (check.next_action === "wait" && check.job_id) {
      syncingPreflight.current = identity;
      localizations.track({ job_id: check.job_id, locale: selected.locale, status: "queued" });
    } else if (check.next_action === "review" || check.next_action === "ready") {
      syncingPreflight.current = identity;
      void localizations.refetch();
    }
  }, [
    preflight?.data,
    preflight?.isFetching,
    open,
    translated,
    selected?.locale,
    localizations.track,
    localizations.refetch,
  ]);
  const canCreate =
    preflight?.data?.ready === true &&
    !preflight.isFetching &&
    preflight.data.next_action === "create";
  const resumableJob = preflight?.data?.next_action === "resume" ? preflight.data.job_id : null;
  const canResume =
    preflight?.data?.ready === true && !preflight.isFetching && Boolean(resumableJob);
  const resumeOrCreate = () => {
    if (
      !selected ||
      creationLock.current ||
      localizations.create.isPending ||
      localizations.resume.isPending
    )
      return;
    if (canResume && resumableJob) {
      creationLock.current = true;
      localizations.resume.mutate(resumableJob, {
        onSettled: () => {
          creationLock.current = false;
        },
      });
    } else if (canCreate) {
      creationLock.current = true;
      localizations.create.mutate(selected.locale, {
        onSettled: () => {
          creationLock.current = false;
        },
      });
    }
  };
  const languageName = (locale: string, name: string) => {
    try {
      return new Intl.DisplayNames(["es"], { type: "language" }).of(locale.split("-")[0]) ?? name;
    } catch {
      return name;
    }
  };
  const [thumbnailPreview, setThumbnailPreview] = useState<ThumbnailPreview | null>(null);
  const visualStyles = useVisualStyles(
    video.design,
    open && !video.scriptReviewRequired,
    undefined,
    video.videoId,
  );
  const recorded = video.rendered.length > 0;
  const badge = video.scriptReviewRequired
    ? tx("studio.scriptReview")
    : isReviewDemo(video)
      ? t("prep.statusReadyForReview")
      : !video.ready
        ? t("prep.statusPreparing")
        : recorded
          ? t("prep.statusRendered")
          : t("prep.statusReady");

  const trigger = (
    <button
      type="button"
      aria-label={`${t("card.openPreview")}: ${video.title}`}
      className={cn(
        "group flex h-full min-w-0 w-full cursor-pointer flex-col overflow-hidden rounded-[10px] border border-black/5 bg-nb-surface text-left transition-transform hover:-translate-y-0.5",
        "shadow-[0_8px_20px_-16px_rgba(40,30,10,0.16),0_2px_8px_-5px_rgba(40,30,10,0.05),inset_0_1px_0_rgba(255,255,255,0.45)]",
      )}
    >
      <div className="relative aspect-[1.65] w-full shrink-0 overflow-hidden bg-black">
        {/* La portada (imagen liviana). El video se reproduce con sonido en el modal:
            cargar el motor en vivo en cada tarjeta es pesado y el navegador puede
            bloquear su autoplay dentro de un iframe de otro origen. */}
        {video.posterUrl ? (
          // biome-ignore lint/performance/noImgElement: portada servida por el backend, sin optimizar
          <img
            src={video.posterUrl}
            alt={video.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <iframe
            src={withParam(video.previewUrl, `t=${POSTER_SECOND}`)}
            title={`${video.title} preview`}
            aria-hidden="true"
            tabIndex={-1}
            loading="lazy"
            className="pointer-events-none size-full border-0"
          />
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="flex size-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
            <Play className="size-5 fill-current" />
          </span>
        </span>
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9.5px] font-bold text-white uppercase">
            {badge}
          </span>
          {video.demo && (
            <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[9.5px] font-bold text-black uppercase">
              {t("prep.demo")}
            </span>
          )}
          {video.qualityIssues.length > 0 && (
            <span
              title={video.qualityIssues.join("\n")}
              className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[9.5px] font-bold text-black uppercase"
            >
              {t("prep.qualityIssues")}
            </span>
          )}
        </div>
        {video.durationSeconds !== null && (
          <span className="absolute right-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {Math.floor(video.durationSeconds / 60)}:
            {String(Math.round(video.durationSeconds % 60)).padStart(2, "0")}
          </span>
        )}
      </div>
      <div className="flex min-h-9 items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[9px] font-bold tracking-[0.08em] text-nb-mute uppercase">
            {video.designName || video.design}
          </p>
          <h4 className="truncate text-[12px] font-bold tracking-[-0.015em] text-nb-ink">
            {video.youtubeTitle || video.title}
          </h4>
        </div>
        <div className="flex shrink-0 gap-1">
          {video.publishReady && !video.scriptReviewRequired && (
            <span className="rounded-full bg-nb-bg-2 px-1.5 py-0.5 text-[9px] font-semibold text-nb-ink-soft">
              {t("prep.tagPublishable")}
            </span>
          )}
        </div>
      </div>
    </button>
  );

  if (video.scriptReviewRequired) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="flex max-h-[90dvh] w-[96vw] max-w-[96vw] flex-col overflow-hidden p-5 sm:max-w-6xl">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>{video.title}</DialogTitle>
            <DialogDescription>{tx("studio.scriptReviewHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto md:grid-cols-[minmax(0,1fr)_360px]">
            <article className="rounded-xl bg-nb-surface p-5 text-[15px] leading-7 whitespace-pre-line text-nb-ink md:overflow-y-auto">
              {video.scriptText}
            </article>
            <ExplainerStudioSidebar
              video={video}
              thumbnailPreview={null}
              onThumbnailPreview={setThumbnailPreview}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // El mismo reproductor que NodeMotion (play/pausa, barra de tiempo, ±5 s, volumen,
  // pantalla completa, móvil/desktop). Los controles los implementa el motor del kit
  // (engine/player.js) con ?controls=1, para todos los diseños por igual.
  return (
    <MediaPlayerModal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setThumbnailPreview(null);
      }}
      trigger={trigger}
      title={
        thumbnailPreview
          ? `${video.title} · Miniatura ${thumbnailPreview.option}`
          : translated && selected.title
            ? selected.title
            : translated
              ? `Versión en ${languageName(selected.locale, selected.name)}`
              : video.title
      }
      description={`${video.designName || video.design} · ${video.categoryName}${narrativeLabel ? ` · ${tx("narratives.used", { label: narrativeLabel })}` : ""}${video.demo ? ` · ${t("prep.demoNote")}` : ""}`}
      source={
        playable
          ? {
              kind: "iframe",
              url: thumbnailPreview?.componentPreviewUrl
                ? playableComponentUrl(thumbnailPreview.componentPreviewUrl)
                : withParam(
                    translated && selected.preview_url
                      ? resolveApiUrl(selected.preview_url)
                      : video.previewUrl,
                    `controls=1&volume=${PLAYER_VOLUME}`,
                  ),
              poster: thumbnailPreview || translated ? null : video.posterUrl,
            }
          : null
      }
      leftControls={
        data?.supported && data.locales.length > 1 ? (
          <fieldset aria-label="Idioma" className="flex gap-1">
            {data.locales.map((item) => (
              <button
                key={item.locale}
                type="button"
                aria-pressed={item.locale === (selectedLocale ?? data.default_locale)}
                onClick={() => {
                  setSelectedLocale(item.locale);
                  setThumbnailPreview(null);
                }}
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold aria-pressed:bg-white aria-pressed:text-black"
              >
                {item.label}
              </button>
            ))}
          </fieldset>
        ) : undefined
      }
      stageContent={
        translated && !playable ? (
          <div className="text-center" role="status">
            {status === "missing" || status === "failed" ? (
              <>
                <p>
                  {status === "failed"
                    ? (job?.error ?? selected.error ?? "No se pudo crear la versión.")
                    : `Esta versión aún no está disponible en ${languageName(selected.locale, selected.name)}.`}
                </p>
                <button
                  type="button"
                  disabled={
                    localizations.create.isPending ||
                    localizations.resume.isPending ||
                    (!canCreate && !canResume)
                  }
                  onClick={resumeOrCreate}
                  className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                >
                  {canResume
                    ? "Reanudar versión"
                    : status === "failed"
                      ? "Reintentar"
                      : `Crear versión en ${languageName(selected.locale, selected.name)}`}
                </button>
                {preflight?.isPending && (
                  <p className="mt-2 text-sm">Comprobando que todo esté listo…</p>
                )}
                {preflight?.data?.issues.map((issue) => (
                  <p key={`${issue.field}:${issue.message}`} className="mt-2 text-sm">
                    {issue.message}
                  </p>
                ))}
                {preflight?.data?.ready === false && !preflight.isFetching && (
                  <button
                    type="button"
                    onClick={() => {
                      void preflight.refetch();
                    }}
                    className="mt-2 text-sm underline"
                  >
                    Volver a comprobar
                  </button>
                )}
                {preflight?.isError && (
                  <div className="mt-2 text-sm">
                    <p>No se pudo comprobar si la edición está lista para crearse.</p>
                    <button
                      type="button"
                      onClick={() => {
                        void preflight.refetch();
                      }}
                      className="mt-1 underline"
                    >
                      Volver a comprobar
                    </button>
                  </div>
                )}
                {localizations.create.error && (
                  <p className="mt-2">{localizations.create.error.message}</p>
                )}
                {localizations.resume.error && (
                  <p className="mt-2">{localizations.resume.error.message}</p>
                )}
              </>
            ) : (
              <p>
                {status === "ready" || status === "needs_review"
                  ? "Vista previa no disponible."
                  : status === "completed"
                    ? "Finalizando edición…"
                    : `${job?.stage ?? selected.progress?.stage ?? "En cola"} · ${job?.percent ?? selected.progress?.percent ?? 0}%`}
              </p>
            )}
          </div>
        ) : undefined
      }
      actions={
        localizations.isError ? (
          <span role="status" className="text-xs text-amber-200">
            No se pudo actualizar el estado del idioma.
          </span>
        ) : thumbnailPreview?.componentPreviewUrl ? (
          <button
            type="button"
            onClick={() => setThumbnailPreview(null)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85 transition-colors hover:bg-white/20 hover:text-white"
          >
            <ArrowLeft className="size-3.5" />
            {playerText("backToVideo")}
          </button>
        ) : undefined
      }
      styleOptions={thumbnailPreview ? undefined : visualStyles.data?.styles}
      defaultStyle={visualStyles.data?.default}
      defaultVolume={PLAYER_VOLUME}
      defaultViewport={video.previewMode ?? "desktop"}
      sidebar={
        <ExplainerStudioSidebar
          video={video}
          edition={
            translated && !playable
              ? {
                  ...selected,
                  status:
                    status === "failed"
                      ? "failed"
                      : activeLocalization(status ?? "") || status === "completed"
                        ? "generating"
                        : selected.status,
                  progress: job
                    ? {
                        stage: job.status === "completed" ? "Finalizando edición" : job.stage,
                        percent: job.percent,
                      }
                    : selected.progress,
                  title: null,
                  publish: null,
                  studio: null,
                }
              : selected
          }
          thumbnailPreview={thumbnailPreview}
          onThumbnailPreview={setThumbnailPreview}
        />
      }
      sidebarToggleLabel={tx("studio.toggleSidebar")}
      stagePreview={
        thumbnailPreview && !thumbnailPreview.componentPreviewUrl ? (
          <ThumbnailArtwork
            preview={thumbnailPreview}
            imagePendingLabel={tx("studio.package.imagePending")}
          />
        ) : null
      }
      onCloseStagePreview={() => setThumbnailPreview(null)}
    />
  );
}
