"use client";

import { useTranslations } from "next-intl";
import { Fragment, type RefObject, useEffect, useRef, useState } from "react";
import { resolveAssetFileUrl } from "@/features/library/api/library-assets-service";
import { cn } from "@/lib/utils";
import { useLyrics } from "../hooks/useResources";

interface LyricsViewerProps {
  assetId: string;
  /** Reproductor externo con el que sincronizar. Si falta, se muestra uno propio. */
  audioRef?: RefObject<HTMLAudioElement | null>;
  className?: string;
}

/** Letra transcripta palabra por palabra. Resalta la palabra que suena y
 * hacer clic en una palabra salta a ese momento de la canción. */
export function LyricsViewer({ assetId, audioRef, className }: LyricsViewerProps) {
  const t = useTranslations("resources.lyrics");
  const { data: lyrics, isLoading, isError } = useLyrics(assetId);
  const ownAudioRef = useRef<HTMLAudioElement>(null);
  const activeAudio = audioRef ?? ownAudioRef;
  const [time, setTime] = useState(-1);
  const activeWordRef = useRef<HTMLButtonElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // timeupdate dispara ~4 veces por segundo: poco para resaltar palabras.
  // Mientras suena se lee currentTime en cada frame.
  useEffect(() => {
    const audio = activeAudio.current;
    if (!audio) return;
    let raf = 0;
    const tick = () => {
      setTime(audio.currentTime);
      if (!audio.paused) raf = requestAnimationFrame(tick);
    };
    const onPlay = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const onSeek = () => setTime(audio.currentTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("seeked", onSeek);
    return () => {
      cancelAnimationFrame(raf);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("seeked", onSeek);
    };
  }, [activeAudio]);

  // Mantener visible la palabra activa sin mover la página entera.
  useEffect(() => {
    const word = activeWordRef.current;
    const scroller = scrollerRef.current;
    if (!word || !scroller) return;
    const top = word.offsetTop - scroller.offsetTop;
    if (top < scroller.scrollTop || top > scroller.scrollTop + scroller.clientHeight - 40) {
      scroller.scrollTo({ top: Math.max(0, top - scroller.clientHeight / 3), behavior: "smooth" });
    }
  });

  function seek(seconds: number) {
    const audio = activeAudio.current;
    if (!audio) return;
    audio.currentTime = seconds;
    void audio.play().catch(() => undefined);
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {!audioRef && (
        // biome-ignore lint/a11y/useMediaCaption: la letra se muestra al lado como transcripción
        <audio
          ref={ownAudioRef}
          src={resolveAssetFileUrl("music", assetId)}
          controls
          preload="metadata"
          className="h-9 w-full"
        />
      )}
      {isLoading && <p className="py-6 text-center text-sm text-nb-mute">{t("loading")}</p>}
      {isError && <p className="py-6 text-center text-sm text-nb-mute">{t("empty")}</p>}
      {lyrics && lyrics.segments.length === 0 && (
        <p className="py-6 text-center text-sm text-nb-mute">{t("empty")}</p>
      )}
      {lyrics && lyrics.segments.length > 0 && (
        <div
          ref={scrollerRef}
          className="relative max-h-[50vh] space-y-2.5 overflow-y-auto rounded-xl border border-nb-line bg-nb-bg p-4 text-[15px] leading-relaxed"
        >
          {lyrics.language && (
            <p className="text-[11px] font-semibold tracking-wide text-nb-mute uppercase">
              {t("language", { language: lyrics.language })}
            </p>
          )}
          {lyrics.segments.map((segment) => {
            const segmentActive = time >= segment.start && time < segment.end;
            return (
              <p
                key={segment.id}
                className={cn(
                  "transition-colors",
                  segmentActive ? "text-nb-ink" : "text-nb-ink-soft/80",
                )}
              >
                {segment.words.length === 0 ? (
                  <button type="button" onClick={() => seek(segment.start)} className="text-left">
                    {segment.text}
                  </button>
                ) : (
                  segment.words.map((word, index) => {
                    const active = time >= word.start && time < word.end;
                    const past = time >= word.end;
                    // Whisper trae el espacio pegado al inicio (" palabra"); dentro de
                    // un <button> inline-block se perdería, así que va afuera.
                    return (
                      // biome-ignore lint/suspicious/noArrayIndexKey: palabras repetidas en el mismo segmento
                      <Fragment key={`${segment.id}-${index}`}>
                        {index > 0 && " "}
                        <button
                          ref={active ? activeWordRef : undefined}
                          type="button"
                          onClick={() => seek(word.start)}
                          title={`${word.start.toFixed(2)}s`}
                          className={cn(
                            "rounded px-px transition-colors hover:bg-nb-green/30",
                            active && "bg-nb-green font-semibold text-nb-ink",
                            !active && past && segmentActive && "text-nb-ink",
                          )}
                        >
                          {word.word.trim()}
                        </button>
                      </Fragment>
                    );
                  })
                )}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
