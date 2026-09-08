"use client";

import { Code2, Play, Square, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { EngineBadge } from "@/features/templates/components/EngineBadge";
import { PreviewModal } from "@/features/templates/components/PreviewModal";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import type { GalleryItem } from "@/infrastructure/api/types";
import { cn } from "@/shared/lib/utils";
import { Link } from "@/i18n/navigation";
import "./GalleryCard.css";

export function GalleryCard({ item }: { item: GalleryItem }) {
  const t = useTranslations("gallery");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const title = t("videoTitle", { format: item.format, id: item.jobId.slice(0, 8) });
  const videoUrl = resolveApiUrl(item.videoUrl);
  const details = t("videoDetails", {
    resolution: item.width && item.height ? `${item.width}×${item.height}` : "—",
    duration: item.durationSeconds?.toFixed(1) ?? "—",
    codec: item.codec ?? "—",
  });

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  return (
    <div className={cn("nr-gallery-card", item.format === "mobile" && "nr-gallery-card--mobile")}>
      <video
        ref={videoRef}
        className="nr-gallery-card__video"
        src={videoUrl}
        muted
        autoPlay
        loop
        preload="metadata"
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <div className="nr-gallery-card__body">
        <div className="nr-gallery-card__meta">
          <div className="nr-gallery-card__info">
            <strong className="nr-gallery-card__name">{title}</strong>
            <div className="nr-gallery-card__labels">
              <EngineBadge engine={item.engine} />
              <span className="nr-gallery-card__fps">{t("fps", { fps: item.fps })}</span>
            </div>
            <p className="nr-gallery-card__description">{details}</p>
            <Link className="nr-gallery-card__study-link" href={`/plantillas/render/${item.jobId}`}>
              <Code2 size={14} aria-hidden="true" />
              {t("openStudio")}
            </Link>
          </div>
          <fieldset className="nr-gallery-card__controls" aria-label={t("videoControls")}>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? t("unmute") : t("mute")}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <button
              type="button"
              className={cn("nr-gallery-card__control--play", isPlaying && "is-playing")}
              onClick={togglePlayback}
              aria-label={isPlaying ? t("stop") : t("play")}
            >
              {isPlaying ? (
                <Square size={14} fill="currentColor" />
              ) : (
                <Play size={15} fill="currentColor" />
              )}
            </button>
            <PreviewModal
              title={title}
              openLabel={t("openPreview")}
              closeLabel={t("closePreview")}
              details={
                <div className="nr-gallery-card__modal-details">
                  <EngineBadge engine={item.engine} />
                  <span>{details}</span>
                  <span>{t("fps", { fps: item.fps })}</span>
                </div>
              }
            >
              {/* biome-ignore lint/a11y/useMediaCaption: gallery renders user-generated videos; a caption track is unavailable unless supplied with the render. */}
              <video src={videoUrl} controls autoPlay loop preload="metadata" playsInline />
            </PreviewModal>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
