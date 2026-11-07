"use client";

import { Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { type ShowcaseEntry, safeShowcaseUrl } from "../api/standard-showcase-repository";

/** Both the kit and standalone engines report readiness; only kit accepts playback commands. */
export function StandardShowcasePreview({
  entry,
  format,
  suspended = false,
  modal = false,
}: {
  entry: ShowcaseEntry;
  format: "9x16" | "16x9";
  suspended?: boolean;
  modal?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const ended = useRef(false);
  const [visible, setVisible] = useState(modal);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [paused, setPaused] = useState(false);
  const [controlled, setControlled] = useState(false);
  const path = safeShowcaseUrl(entry.preview_url);
  const url = path ? new URL(path, "https://showcase.invalid") : null;
  url?.searchParams.set("format", format);
  const src = url ? resolveApiUrl(`${url.pathname}${url.search}${url.hash}`) : "";
  const mounted = visible && !suspended;

  useEffect(() => {
    if (modal || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([value]) => setVisible(value.isIntersecting), {
      rootMargin: "100px",
    });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, [modal]);

  // A retry or re-entry creates a fresh iframe session, never trusts another frame's events.
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt identifies a new frame session.
  useEffect(() => {
    setStatus("loading");
    setControlled(false);
    setPaused(false);
    ended.current = false;
    if (!mounted || !src || entry.preview_kind !== "iframe") return;
    const origin = new URL(src, window.location.href).origin;
    const timeout = window.setTimeout(() => setStatus("error"), 30_000);
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== origin) return;
      if (event.data?.type === "nexa-animation-error") {
        window.clearTimeout(timeout);
        setStatus("error");
      }
      if (
        event.data?.type === "nexa-animation-ready" ||
        event.data?.type === "nexa-template-ready"
      ) {
        window.clearTimeout(timeout);
        setStatus("ready");
        if (event.data.type === "nexa-template-ready") {
          setControlled(true);
          frame.current?.contentWindow?.postMessage(
            { type: "nexa-template-volume", muted: true, volume: 0 },
            origin,
          );
          if (!modal)
            frame.current?.contentWindow?.postMessage(
              { type: "nexa-template-seek", time: 0.35 },
              origin,
            );
          frame.current?.contentWindow?.postMessage(
            { type: "nexa-template-playback", playing: true },
            origin,
          );
        }
      }
      if (event.data?.type === "nexa-template-ended") {
        if (!modal) {
          frame.current?.contentWindow?.postMessage(
            { type: "nexa-template-seek", time: 0.35 },
            origin,
          );
          frame.current?.contentWindow?.postMessage(
            { type: "nexa-template-playback", playing: true },
            origin,
          );
        } else {
          ended.current = true;
          setPaused(true);
        }
      }
    };
    window.addEventListener("message", receive);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
  }, [src, mounted, entry.preview_kind, attempt, modal]);

  function toggle() {
    const origin = new URL(src, window.location.href).origin;
    if (ended.current) {
      frame.current?.contentWindow?.postMessage({ type: "nexa-template-seek", time: 0 }, origin);
      ended.current = false;
    }
    frame.current?.contentWindow?.postMessage(
      { type: "nexa-template-playback", playing: paused },
      origin,
    );
    setPaused(!paused);
  }

  return (
    <div
      ref={host}
      data-standard-preview
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-white"
      style={{ aspectRatio: format === "9x16" ? "9 / 16" : "16 / 9" }}
    >
      {!path ? (
        <p className="p-5 text-center text-sm text-nb-ink-soft">Vista previa no disponible.</p>
      ) : entry.preview_kind === "json" ? (
        <p className="flex items-center gap-2 p-5 text-sm text-nb-ink-soft">
          <Play aria-hidden className="size-4" />
          Ver instrucciones y parámetros
        </p>
      ) : entry.preview_kind === "image" ? (
        // biome-ignore lint/performance/noImgElement: authenticated image uses the current browser session.
        <img
          key={`${src}:${attempt}`}
          src={src}
          alt={entry.label}
          loading="lazy"
          className="h-full w-full object-contain"
          onError={() => setStatus("error")}
        />
      ) : mounted ? (
        <>
          <iframe
            key={`${src}:${attempt}`}
            ref={frame}
            title={`Vista previa de ${entry.label}`}
            src={src}
            sandbox="allow-scripts allow-same-origin"
            className={`absolute inset-0 h-full w-full border-0 ${modal ? "" : "pointer-events-none"}`}
            allow="autoplay"
          />
          {status === "loading" && (
            <p
              role="status"
              className="pointer-events-none absolute inset-0 grid place-items-center bg-white/90 p-4 text-center text-xs text-nb-ink-soft"
            >
              Preparando vista previa…
            </p>
          )}
          <div className="absolute bottom-3 right-3 flex gap-1.5">
            {modal && controlled && (
              <button
                type="button"
                onClick={toggle}
                className="rounded-full border border-nb-line bg-white px-3 py-2 text-xs text-nb-ink shadow-sm"
              >
                {paused ? "Reanudar" : "Pausar"}
              </button>
            )}
            <button
              type="button"
              aria-label={`Repetir animación de ${entry.label}`}
              onClick={(event) => {
                event.stopPropagation();
                setAttempt((value) => value + 1);
              }}
              className="grid size-8 place-items-center rounded-full border border-nb-line bg-white text-nb-ink shadow-sm hover:bg-nb-bg-2"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </>
      ) : (
        <p className="p-4 text-xs text-nb-ink-soft">Vista previa</p>
      )}
      {status === "error" && path && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white p-5 text-center text-sm text-nb-ink-soft"
        >
          <p>No se pudo cargar la vista previa.</p>
          <button
            type="button"
            onClick={() => {
              setStatus("loading");
              setAttempt((value) => value + 1);
            }}
            className="rounded-full border border-nb-line px-3 py-1.5 text-xs text-nb-ink"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
