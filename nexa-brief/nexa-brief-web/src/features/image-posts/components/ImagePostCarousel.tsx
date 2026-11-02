"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CSSProperties, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type ImagePostFormat, imageFormatProfile } from "../image-formats";
import type { ImageSlide, Platform } from "../types";
import { CodeSlidePreview } from "./CodeSlidePreview";
import styles from "./PublishedPostModal.module.css";

export function ImagePostCarousel({
  slides,
  activeIndex,
  onSelect,
  title,
  platform,
  previewUrl,
  onImageError,
  format = "4:5",
  sourcePostId,
  revision,
}: {
  slides: ImageSlide[];
  activeIndex: number;
  onSelect: (index: number) => void;
  title: string;
  platform: Platform;
  previewUrl: string;
  onImageError: () => void;
  format?: ImagePostFormat;
  sourcePostId?: string | null;
  revision?: number;
}) {
  const t = useTranslations("imagePosts.modal");
  const gesture = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const wheel = useRef({ distance: 0, lastChange: 0 });
  const [warmScope, setWarmScope] = useState<string | null>(null);
  const scope = JSON.stringify([sourcePostId, revision, format]);
  const warmNeighbors = warmScope === scope;
  const count = slides.length;
  const profile = imageFormatProfile(format);
  // Keep DOM order stable so the same cards and iframes can animate between positions.
  const cards = slides.map((slide, index) => ({
    slide,
    index,
    depth: Math.abs(index - activeIndex),
    position: index === activeIndex ? "selected" : index < activeIndex ? "previous" : "next",
  }));
  const move = (direction: number) => {
    const next = activeIndex + direction;
    if (next >= 0 && next < count) onSelect(next);
  };

  return (
    <section
      className={styles.carousel}
      style={
        {
          "--card-ratio": profile.width / profile.height,
          "--card-width": `min(52.2cqw, calc((100cqh - 44px) * ${profile.width / profile.height} * 0.9))`,
        } as CSSProperties
      }
      aria-roledescription="carrusel"
      aria-label={title}
      onPointerDown={(event) => {
        if (count < 2 || event.button !== 0 || (event.target as HTMLElement).closest("button"))
          return;
        gesture.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        const start = gesture.current;
        gesture.current = null;
        if (!start || start.pointerId !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
      }}
      onPointerCancel={() => {
        gesture.current = null;
      }}
      onWheel={(event) => {
        if (count < 2 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        const now = Date.now();
        if (now - wheel.current.lastChange < 350) return;
        wheel.current.distance += event.deltaX;
        if (Math.abs(wheel.current.distance) < 60) return;
        move(wheel.current.distance > 0 ? 1 : -1);
        wheel.current = { distance: 0, lastChange: now };
      }}
    >
      {cards.map(({ slide, index, position, depth }) => (
        <figure
          key={slide.slideId}
          className={cn(
            styles.carouselCard,
            position === "selected" ? styles.carouselSelected : styles.carouselNeighbor,
          )}
          data-side={position}
          data-slide-id={slide.slideId}
          style={
            {
              "--card-depth": Math.min(depth - 1, 4),
              zIndex: position === "selected" ? 10 : Math.max(1, 9 - depth),
              willChange: depth <= 1 ? "transform" : undefined,
            } as CSSProperties
          }
        >
          {sourcePostId && (position === "selected" || (warmNeighbors && depth <= 1)) ? (
            <CodeSlidePreview
              postId={sourcePostId}
              slideId={slide.slideId}
              format={format}
              revision={revision}
              title={
                (platform === "facebook" ? slide.altTextFacebook : slide.altTextInstagram) || title
              }
              decorative={position !== "selected"}
              fallbackUrl={slide.previewUrl ?? undefined}
              onReady={position === "selected" ? () => setWarmScope(scope) : undefined}
            />
          ) : (position === "selected" ? previewUrl : slide.previewUrl) ? (
            // biome-ignore lint/performance/noImgElement: las vistas previas usan URLs firmadas de la API.
            <img
              src={(position === "selected" ? previewUrl : slide.previewUrl) ?? undefined}
              alt={
                position === "selected"
                  ? (platform === "facebook" ? slide.altTextFacebook : slide.altTextInstagram) ||
                    title
                  : ""
              }
              onError={position === "selected" ? onImageError : undefined}
              draggable={false}
            />
          ) : (
            <span>{index + 1}</span>
          )}
          {position === "selected" && slide.roleTag && (
            <span className={styles.carouselTag} aria-live="polite">
              {slide.roleTag}
            </span>
          )}
          {(position === "previous" || position === "next") && (
            <button
              type="button"
              className={styles.carouselNeighborSelect}
              tabIndex={-1}
              aria-label={`${t(position === "previous" ? "previousSlide" : "nextSlide")} · vista previa ${index + 1}`}
              onClick={() => onSelect(index)}
            />
          )}
        </figure>
      ))}
      {count > 1 && (
        <>
          {activeIndex > 0 && (
            <button
              type="button"
              aria-label={t("previousSlide")}
              onClick={() => move(-1)}
              className={cn(styles.carouselArrow, styles.carouselPrevious)}
            >
              <ArrowLeft className="size-5" />
            </button>
          )}
          {activeIndex < count - 1 && (
            <button
              type="button"
              aria-label={t("nextSlide")}
              onClick={() => move(1)}
              className={cn(styles.carouselArrow, styles.carouselNext)}
            >
              <ArrowRight className="size-5" />
            </button>
          )}
        </>
      )}
      <div className={styles.carouselPagination}>
        <span aria-live="polite" aria-atomic="true">
          {activeIndex + 1} / {count}
        </span>
        {count > 1 && (
          <div className={styles.carouselDots}>
            {slides.map((slide, index) => (
              <button
                key={slide.slideId}
                type="button"
                aria-label={t("showSlide", { number: index + 1 })}
                aria-current={index === activeIndex}
                onClick={() => onSelect(index)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
