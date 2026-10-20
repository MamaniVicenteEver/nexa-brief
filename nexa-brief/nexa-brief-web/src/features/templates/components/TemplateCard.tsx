"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { TemplateStudioModal } from "@/features/studio/components/TemplateStudioModal";
import { MediaPlayerModal } from "@/shared/components/media/MediaPlayerModal";
import type { Template } from "../types";

const ORIENTATION_LABEL_KEY: Record<Template["nativeOrientation"], string> = {
  "9:16": "card.orientationVertical",
  "16:9": "card.orientationHorizontal",
  any: "card.orientationAny",
};

// Mismas imágenes que usa la fila de plantillas de la home
// (histórico) — los 3 templates de letras comparten una sola
// imagen genérica porque todavía no hay una miniatura por variante.
const FALLBACK_PREVIEW_IMAGE: Record<string, string> = {
  "01-image-bg": "/images/templates/image-bg.png",
  "subject-spotlight": "/images/templates/subject-png.png",
  "living-landscape": "/images/templates/landscape-scene.png",
  "motion-backdrop": "/images/templates/video-motion.png",
  "lyrics-neon": "/images/templates/lyrics.png",
  "lyrics-impact": "/images/templates/lyrics.png",
  "lyrics-romantic": "/images/templates/lyrics.png",
};

const DEFAULT_PREVIEW_VOLUME = 0.05;

export function TemplateCard({
  template,
  hideRecorder = false,
  className,
}: {
  template: Template;
  /** Vista de solo lectura (landing): sin Estudio en el modal y sin el motor
   * de grabación que trae cada plantilla (#rec-btn). */
  hideRecorder?: boolean;
  className?: string;
}) {
  const t = useTranslations("templates");
  const previewSrc =
    template.previewImageUrl ??
    FALLBACK_PREVIEW_IMAGE[template.id] ??
    "/images/templates/lyrics.png";
  // Letras de Neon conserva su clip original como vista animada de la tarjeta.
  const previewVideo = template.id === "lyrics-neon" ? template.previewVideoUrl : null;
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [showcaseActive, setShowcaseActive] = useState(false);
  // La plantilla completa solo se renderiza en el iframe durante hover/foco;
  // las cards quietas cargan la portada sin iniciar su showcase.
  const [showcaseLive, setShowcaseLive] = useState(false);
  const showcaseFrameRef = useRef<HTMLIFrameElement>(null);
  const recorderParam = hideRecorder ? "&norec=1" : "";
  const showcasePreviewUrl = template.showcaseUrl
    ? `${template.showcaseUrl}?muted=1&preview=card${recorderParam}`
    : null;
  const modalPreviewUrl = template.showcaseUrl
    ? `${template.showcaseUrl}?controls=1&volume=${DEFAULT_PREVIEW_VOLUME}${recorderParam}`
    : null;

  const setShowcasePlayback = (playing: boolean) => {
    if (playing) setShowcaseLive(true);
    setShowcaseActive(playing);
    showcaseFrameRef.current?.contentWindow?.postMessage(
      { type: "nexa-template-preview", playing },
      "*",
    );
  };

  const resetShowcase = () => {
    setShowcaseActive(false);
    showcaseFrameRef.current?.contentWindow?.postMessage({ type: "nexa-template-reset" }, "*");
    showcaseFrameRef.current?.contentWindow?.postMessage(
      { type: "nexa-template-preview", playing: false },
      "*",
    );

    // Al salir, desmontar el iframe libera su render, decodificador y conexiones.
    setShowcaseLive(false);
  };

  useEffect(() => {
    showcaseFrameRef.current?.contentWindow?.postMessage(
      { type: "nexa-template-preview", playing: showcaseActive },
      "*",
    );
  }, [showcaseActive]);

  const handleShowcaseOpenChange = (open: boolean) => {
    setShowcaseOpen(open);
    resetShowcase();
  };

  const trigger = (
    <button
      type="button"
      aria-label={`${t("card.openPreview")}: ${template.displayName}`}
      className={cn(
        "group flex cursor-pointer flex-col overflow-hidden rounded-[10px] border border-black/5 bg-nb-surface text-left transition-transform hover:-translate-y-0.5",
        "shadow-[0_8px_20px_-16px_rgba(40,30,10,0.16),0_2px_8px_-5px_rgba(40,30,10,0.05),inset_0_1px_0_rgba(255,255,255,0.45)]",
        className,
      )}
      onMouseEnter={() => setShowcasePlayback(true)}
      onMouseLeave={resetShowcase}
      onFocus={() => setShowcasePlayback(true)}
      onBlur={(event) => {
        const relatedTarget = event.relatedTarget;
        if (!relatedTarget || !event.currentTarget.contains(relatedTarget as Node)) {
          resetShowcase();
        }
      }}
    >
      <div className="relative flex aspect-[1.65] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-nb-bg-2 to-nb-line text-nb-ink-soft">
        {showcasePreviewUrl && showcaseLive ? (
          <iframe
            ref={showcaseFrameRef}
            src={showcasePreviewUrl}
            title={`${template.displayName} preview`}
            aria-hidden="true"
            tabIndex={-1}
            loading="eager"
            onLoad={(event) => {
              event.currentTarget.contentWindow?.postMessage({ type: "nexa-template-reset" }, "*");
              event.currentTarget.contentWindow?.postMessage(
                { type: "nexa-template-preview", playing: showcaseActive },
                "*",
              );
            }}
            className="pointer-events-none size-full border-0 bg-black"
          />
        ) : !showcaseOpen && previewVideo ? (
          <video
            src={previewVideo}
            poster={previewSrc}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none size-full object-cover"
          />
        ) : previewSrc ? (
          <Image
            src={previewSrc}
            alt={template.displayName}
            fill
            sizes="(max-width: 700px) 100vw, 360px"
            unoptimized={Boolean(template.previewImageUrl)}
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <span className="text-[13px] font-semibold">
            {t(ORIENTATION_LABEL_KEY[template.nativeOrientation])}
          </span>
        )}
      </div>
      <div className="flex min-h-9 items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[9px] font-bold tracking-[0.08em] text-nb-mute uppercase">
            {template.categoryName}
          </p>
          <h4 className="truncate text-[12px] font-bold tracking-[-0.015em] text-nb-ink">
            {template.displayName}
          </h4>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {template.requiresImage && (
            <span className="rounded-full bg-nb-bg-2 px-1.5 py-0.5 text-[9px] font-semibold text-nb-ink-soft">
              {t("card.tagImage")}
            </span>
          )}
          {template.requiresVideo && (
            <span className="rounded-full bg-nb-bg-2 px-1.5 py-0.5 text-[9px] font-semibold text-nb-ink-soft">
              {t("card.tagVideo")}
            </span>
          )}
          {template.requiresLyrics && (
            <span className="rounded-full bg-nb-bg-2 px-1.5 py-0.5 text-[9px] font-semibold text-nb-ink-soft">
              {t("card.tagLyrics")}
            </span>
          )}
        </div>
      </div>
    </button>
  );

  const modalProps = {
    open: showcaseOpen,
    onOpenChange: handleShowcaseOpenChange,
    title: template.displayName,
    description: t("card.previewHint"),
    defaultVolume: DEFAULT_PREVIEW_VOLUME,
    trigger,
  };

  // En /plantillas el modal trae el Estudio (elegir canción/medios,
  // previsualizar y grabar); en vistas de solo lectura como la landing, no.
  if (hideRecorder) {
    return (
      <MediaPlayerModal
        {...modalProps}
        source={
          modalPreviewUrl
            ? { kind: "iframe", url: modalPreviewUrl, poster: template.previewImageUrl }
            : null
        }
      />
    );
  }
  return (
    <TemplateStudioModal
      {...modalProps}
      template={template}
      defaultUrl={modalPreviewUrl}
      poster={template.previewImageUrl}
      previewVolume={DEFAULT_PREVIEW_VOLUME}
    />
  );
}
