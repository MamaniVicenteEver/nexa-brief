"use client";

import { Play, Square } from "lucide-react";
import {
  type CSSProperties,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { PlayerStatus } from "../hooks/useStagePlayer";

export type PreviewBackground = "white" | "dark" | "checker";
export function previewStyle(bg: PreviewBackground): CSSProperties {
  return {
    backgroundColor: bg === "dark" ? "#081e2c" : "#fff",
    ...(bg === "checker"
      ? {
          backgroundImage:
            "conic-gradient(#dce1e5 25%, transparent 0 50%, #dce1e5 0 75%, transparent 0)",
          backgroundSize: "24px 24px",
        }
      : {}),
  };
}
// One shared budget, including grids temporarily suspended behind a modal.
const slots = new Map<symbol, { update(active: boolean): void }>();
function schedule() {
  let remaining = 3;
  // Give an explicit new play request priority over older players.
  for (const slot of [...slots.values()].reverse()) slot.update(remaining-- > 0);
}
export type SandboxAnimationHandle = { start(): void; stop(): void; replay(): void };

export const SandboxAnimationPreview = forwardRef<
  SandboxAnimationHandle,
  {
    src: string;
    poster?: string;
    stillSrc?: string;
    title: string;
    bg: PreviewBackground;
    suspended?: boolean;
    waitForReady?: boolean;
    eager?: boolean;
    aspect?: string;
    frameTitle?: string;
    autoPlay?: boolean;
    hideControl?: boolean;
    onStatusChange?(status: PlayerStatus): void;
  }
>(function SandboxAnimationPreview(
  {
    src,
    poster,
    stillSrc,
    title,
    bg,
    suspended = false,
    waitForReady = false,
    eager = false,
    aspect = "1 / 1",
    frameTitle,
    autoPlay = false,
    hideControl = false,
    onStatusChange,
  },
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const painted = useRef("");
  const [visible, setVisible] = useState(eager);
  const [requestedSource, setRequestedSource] = useState<string | null>(null);
  const [allocated, setAllocated] = useState(false);
  const [readyKey, setReadyKey] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [failedPoster, setFailedPoster] = useState<string | null>(null);
  const posterFailed = !!poster && failedPoster === poster;
  const requested = requestedSource === src;
  const active = requested && allocated && visible && !suspended;
  const sourceKey = `${src}:${attempt}`;
  const ready = active && readyKey === sourceKey;
  useEffect(() => {
    setRequestedSource((current) => (current === src ? current : null));
  }, [src]);
  useEffect(() => {
    const element = container.current;
    let inView = eager || typeof IntersectionObserver === "undefined";
    const visibility = () => {
      const next = inView && !suspended && !document.hidden;
      setVisible(next);
      if (!next) setRequestedSource(null);
    };
    const observer =
      !eager && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              inView = entry.isIntersecting && entry.intersectionRatio > 0;
              visibility();
            },
            { threshold: [0, 0.01] },
          )
        : null;
    if (element) observer?.observe(element);
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [suspended, eager]);
  useEffect(() => {
    if (!requested || !visible || suspended) {
      setAllocated(false);
      return;
    }
    const key = Symbol();
    slots.set(key, {
      update(granted) {
        setAllocated(granted);
        if (!granted) setRequestedSource(null);
      },
    });
    schedule();
    return () => {
      slots.delete(key);
      schedule();
    };
  }, [requested, visible, suspended]);
  useEffect(() => {
    setReadyKey("");
    setFailed(false);
    painted.current = "";
    if (!active) return;
    const origin = new URL(src, window.location.href).origin;
    let completed = false;
    const finish = () => {
      completed = true;
      painted.current = sourceKey;
      setReadyKey(sourceKey);
      setFailed(false);
    };
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "nexa-animation-ready") finish();
      if (event.data?.type === "nexa-animation-error") {
        setReadyKey("");
        painted.current = "";
        setFailed(true);
      }
    };
    window.addEventListener("message", receive);
    const timeout = window.setTimeout(() => {
      if (!completed && painted.current !== sourceKey) setFailed(true);
    }, 30_000);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
  }, [src, sourceKey, active]);
  const play = () => {
    setFailed(false);
    setFailedPoster(null);
    setAttempt((value) => value + 1);
    setRequestedSource(src);
  };
  const loading = requested && !ready && !failed;
  const stopping = requested && !failed;
  const action = stopping
    ? "Detener animación"
    : failed
      ? "Reintentar animación"
      : "Reproducir animación";
  useEffect(() => {
    if (!autoPlay) return;
    setAttempt((value) => value + 1);
    setRequestedSource(src);
  }, [autoPlay, src]);
  useEffect(() => {
    const status: PlayerStatus = failed
      ? "error"
      : requested && !ready
        ? "loading"
        : requested
          ? "playing"
          : "paused";
    onStatusChange?.(status);
  }, [failed, requested, ready, onStatusChange]);
  useImperativeHandle(
    ref,
    () => ({
      start: () => {
        setFailed(false);
        setAttempt((value) => value + 1);
        setRequestedSource(src);
      },
      stop: () => setRequestedSource(null),
      replay: () => {
        setFailed(false);
        setAttempt((value) => value + 1);
        setRequestedSource(src);
      },
    }),
    [src],
  );
  return (
    <div
      ref={container}
      className="relative w-full overflow-hidden"
      style={{ ...previewStyle(bg), aspectRatio: aspect }}
      data-animation-active={active}
      data-animation-ready={ready}
    >
      {poster && !posterFailed && (
        // biome-ignore lint/performance/noImgElement: protected thumbnail URLs need the browser session, not the image optimizer.
        <img
          key={poster}
          src={poster}
          alt={`Miniatura de ${title}`}
          width={480}
          height={480}
          loading={visible || eager ? "eager" : "lazy"}
          fetchPriority={visible || eager ? "high" : "auto"}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full object-contain"
          style={{ opacity: ready ? 0 : 1 }}
          onError={() => setFailedPoster(poster ?? null)}
        />
      )}
      {(!poster || posterFailed) && stillSrc && visible && !active && !suspended && (
        <iframe
          title={`Fotograma de ${title}`}
          src={stillSrc}
          loading="lazy"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full border-0"
        />
      )}
      {(!poster || posterFailed) && !stillSrc && !ready && (
        <p
          role="status"
          className="absolute inset-x-0 top-3 p-4 text-center text-sm"
          style={{ color: bg === "dark" ? "#fff" : "#152c38" }}
        >
          {posterFailed ? "Imagen no disponible" : "Pulsa reproducir para ver la animación"}
        </p>
      )}
      {active && (
        <iframe
          key={sourceKey}
          ref={frame}
          title={frameTitle ?? `Vista previa de ${title}`}
          src={src}
          tabIndex={-1}
          onLoad={() => {
            if (!waitForReady) {
              painted.current = sourceKey;
              setReadyKey(sourceKey);
            }
          }}
          onError={() => {
            setReadyKey("");
            painted.current = "";
            setFailed(true);
          }}
          className="pointer-events-none absolute inset-0 h-full w-full border-0"
          style={{ opacity: ready ? 1 : 0 }}
        />
      )}
      {failed && (
        <p
          role="alert"
          className="absolute inset-0 z-10 grid place-items-center bg-black/80 p-4 text-center text-sm text-white"
        >
          No se pudo cargar la animación. Vuelve a intentarlo.
        </p>
      )}
      {!hideControl && (
        <div className="absolute bottom-3 right-3 z-20">
          <button
            type="button"
            aria-label={`${action} de ${title}`}
            title={loading ? "Cargando animación… Pulsa para detener" : action}
            aria-busy={loading}
            disabled={suspended}
            className="grid size-9 place-items-center rounded-full border border-black/15 bg-white text-black shadow-md hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-50"
            onClick={(event) => {
              event.stopPropagation();
              if (stopping) setRequestedSource(null);
              else play();
            }}
          >
            {stopping ? (
              <Square aria-hidden="true" className="size-4 fill-current" />
            ) : (
              <Play aria-hidden="true" className="ml-0.5 size-4 fill-current" />
            )}
          </button>
        </div>
      )}
    </div>
  );
});
