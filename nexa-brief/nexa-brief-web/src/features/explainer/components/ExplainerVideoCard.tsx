"use client";

import { ArrowLeft, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { MediaPlayerModal } from "@/shared/components/media/MediaPlayerModal";
import type { ExplainerVideo, ThumbnailPreview } from "../types";
import { ExplainerStudioSidebar } from "./ExplainerStudioSidebar";
import { ThumbnailArtwork } from "./ThumbnailArtwork";

// Segundo que se muestra quieto en la tarjeta (después del título de apertura).
const POSTER_SECOND = 6;
const PLAYER_VOLUME = 0.5;

function withParam(url: string, param: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${param}`;
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
  const [thumbnailPreview, setThumbnailPreview] = useState<ThumbnailPreview | null>(null);
  const recorded = video.rendered.length > 0;
  const badge = !video.ready
    ? t("prep.statusPreparing")
    : recorded
      ? t("prep.statusRendered")
      : t("prep.statusReady");

  const trigger = (
    <button
      type="button"
      aria-label={`${t("card.openPreview")}: ${video.title}`}
      className={cn(
        "group flex cursor-pointer flex-col overflow-hidden rounded-[10px] border border-black/5 bg-nb-surface text-left transition-transform hover:-translate-y-0.5",
        "shadow-[0_8px_20px_-16px_rgba(40,30,10,0.16),0_2px_8px_-5px_rgba(40,30,10,0.05),inset_0_1px_0_rgba(255,255,255,0.45)]",
      )}
    >
      <div className="relative aspect-[1.65] w-full overflow-hidden bg-black">
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
            <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[9.5px] font-bold text-black uppercase">
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
          {video.qualityIssues.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
              {[...new Set(video.qualityIssues)].map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          {video.publishReady && (
            <span className="rounded-full bg-nb-bg-2 px-1.5 py-0.5 text-[9px] font-semibold text-nb-ink-soft">
              {t("prep.tagPublishable")}
            </span>
          )}
        </div>
      </div>
    </button>
  );

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
        thumbnailPreview ? `${video.title} · Miniatura ${thumbnailPreview.option}` : video.title
      }
      description={`${video.designName || video.design} · ${video.categoryName}${narrativeLabel ? ` · ${tx("narratives.used", { label: narrativeLabel })}` : ""}${video.demo ? ` · ${t("prep.demoNote")}` : ""}`}
      source={{
        kind: "iframe",
        url: thumbnailPreview?.componentPreviewUrl
          ? playableComponentUrl(thumbnailPreview.componentPreviewUrl)
          : withParam(video.previewUrl, `controls=1&volume=${PLAYER_VOLUME}`),
        poster: thumbnailPreview ? null : video.posterUrl,
      }}
      actions={
        thumbnailPreview?.componentPreviewUrl ? (
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
      defaultVolume={PLAYER_VOLUME}
      defaultViewport="desktop"
      sidebar={
        <ExplainerStudioSidebar
          video={video}
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
