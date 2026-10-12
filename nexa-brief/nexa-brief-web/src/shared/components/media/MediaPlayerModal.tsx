"use client";

import { Loader2, Maximize2, Menu, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  forwardRef,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";

export type MediaViewport = "mobile" | "desktop";

/** Qué reproduce el modal:
 * - `iframe`: una plantilla (index.html) que habla el protocolo postMessage
 *   `nexa-template-*` (playback / volume / seek → time / ended).
 * - `video`: un MP4 ya renderizado; cada viewport usa su propio archivo
 *   (youtube 16:9 en desktop, reels 9:16 en móvil). */
export type MediaSource =
  | { kind: "iframe"; url: string }
  | { kind: "video"; desktopUrl: string | null; mobileUrl: string | null };

interface MediaPlayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  source: MediaSource | null;
  /** Elemento que abre el modal (se envuelve en DialogTrigger). */
  trigger?: ReactNode;
  defaultVolume?: number;
  defaultViewport?: MediaViewport;
  /** Acciones extra en la barra superior (ej. "Publicar" en Biblioteca). */
  actions?: ReactNode;
  /** Panel lateral opcional (el Estudio en /plantillas). Con él aparece un
   * botón ☰ junto a la X que lo abre/cierra dentro del modal y el escenario se
   * achica. Sin él, el modal queda igual (Biblioteca, landing). */
  sidebar?: ReactNode;
  /** Texto accesible del botón ☰ (lo traduce quien pasa el sidebar). */
  sidebarToggleLabel?: string;
  defaultSidebarOpen?: boolean;
}

interface StageHandle {
  seek: (time: number) => void;
  restart: () => void;
  element: () => HTMLElement | null;
}

interface StageProps {
  playing: boolean;
  volume: number;
  muted: boolean;
  onTime: (currentTime: number, duration: number) => void;
  onEnded: () => void;
  onPlayingChange: (playing: boolean) => void;
  /** El stage se silenció solo (el navegador bloqueó el autoplay con sonido). */
  onMutedChange?: (muted: boolean) => void;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Stage: plantilla en iframe ───────────────────────────────────────────────

function postToFrame(frame: HTMLIFrameElement | null, message: Record<string, unknown>) {
  frame?.contentWindow?.postMessage(message, "*");
}

const IframeStage = forwardRef<StageHandle, StageProps & { url: string; title: string }>(
  function IframeStage(
    { url, title, playing, volume, muted, onTime, onEnded, onPlayingChange, onMutedChange },
    ref,
  ) {
    const frameRef = useRef<HTMLIFrameElement>(null);
    const [restartKey, setRestartKey] = useState(0);

    const post = (message: Record<string, unknown>) => postToFrame(frameRef.current, message);
    // Estado actual para reenviarlo cuando el reproductor del iframe avisa que está listo.
    const latest = useRef({ playing, volume, muted });
    latest.current = { playing, volume, muted };

    useImperativeHandle(ref, () => ({
      seek: (time) => post({ type: "nexa-template-seek", time }),
      restart: () => setRestartKey((k) => k + 1),
      element: () => frameRef.current,
    }));

    useEffect(() => {
      postToFrame(frameRef.current, { type: "nexa-template-volume", volume, muted });
    }, [volume, muted]);

    useEffect(() => {
      postToFrame(frameRef.current, { type: "nexa-template-playback", playing });
    }, [playing]);

    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        if (event.source !== frameRef.current?.contentWindow) return;
        if (event.data?.type === "nexa-template-ready") {
          // El reproductor se carga después del evento load: lo que se mandó antes se perdió.
          const { playing: wantPlaying, volume: vol, muted: mute } = latest.current;
          postToFrame(frameRef.current, { type: "nexa-template-volume", volume: vol, muted: mute });
          postToFrame(frameRef.current, { type: "nexa-template-playback", playing: wantPlaying });
        }
        if (event.data?.type === "nexa-template-time") {
          onTime(Number(event.data.currentTime), Number(event.data.duration));
        }
        if (event.data?.type === "nexa-template-ended") onEnded();
        // Estado real del reproductor: si el navegador rechazó el play(), el botón
        // no queda en "Pausar" con el video quieto.
        if (event.data?.type === "nexa-template-state") onPlayingChange(Boolean(event.data.playing));
        if (event.data?.type === "nexa-template-muted") onMutedChange?.(Boolean(event.data.muted));
      };
      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }, [onTime, onEnded, onPlayingChange, onMutedChange]);

    return (
      <iframe
        key={restartKey}
        ref={frameRef}
        src={url}
        title={title}
        allow="autoplay; fullscreen"
        onLoad={() => {
          post({ type: "nexa-template-volume", volume, muted });
          post({ type: "nexa-template-playback", playing });
        }}
        className="size-full border-0 bg-black"
      />
    );
  },
);

// ── Stage: MP4 renderizado ───────────────────────────────────────────────────

const VideoStage = forwardRef<
  StageHandle,
  StageProps & { url: string; startAt: number; errorLabel: string }
>(function VideoStage(
  { url, startAt, errorLabel, playing, volume, muted, onTime, onEnded, onPlayingChange },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [buffering, setBuffering] = useState(true);
  const [failed, setFailed] = useState(false);

  useImperativeHandle(ref, () => ({
    seek: (time) => {
      if (videoRef.current) videoRef.current.currentTime = time;
    },
    restart: () => {
      if (videoRef.current) videoRef.current.currentTime = 0;
    },
    element: () => videoRef.current,
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.play().catch(() => onPlayingChange(false));
    } else {
      video.pause();
    }
  }, [playing, onPlayingChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted]);

  if (failed) {
    return (
      <div className="flex size-full items-center justify-center p-6 text-center text-sm text-white/70">
        {errorLabel}
      </div>
    );
  }

  return (
    <div className="relative size-full">
      {/** biome-ignore lint/a11y/useMediaCaption: video generado por el pipeline, sin pista de subtítulos disponible */}
      <video
        ref={videoRef}
        src={url}
        playsInline
        preload="auto"
        onClick={() => onPlayingChange(!playing)}
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          video.volume = volume;
          video.muted = muted;
          if (startAt > 0 && startAt < video.duration) video.currentTime = startAt;
          onTime(video.currentTime, video.duration);
          if (playing) video.play().catch(() => onPlayingChange(false));
        }}
        onTimeUpdate={(e) => onTime(e.currentTarget.currentTime, e.currentTarget.duration)}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onPlaying={() => setBuffering(false)}
        onEnded={onEnded}
        onError={() => setFailed(true)}
        className="size-full cursor-pointer bg-black object-contain"
      />
      {buffering && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-white/70" />
        </div>
      )}
    </div>
  );
});

// ── Modal ────────────────────────────────────────────────────────────────────

export function MediaPlayerModal({
  open,
  onOpenChange,
  title,
  description,
  source,
  trigger,
  defaultVolume = 0.6,
  defaultViewport = "desktop",
  actions,
  sidebar,
  sidebarToggleLabel = "Panel",
  defaultSidebarOpen = true,
}: MediaPlayerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={cn(
          "w-[min(94vw,1440px)] !max-w-[min(94vw,1440px)] gap-2 rounded-[24px] bg-black p-2 text-white ring-white/10",
          // Con sidebar el modal ocupa casi toda la pantalla: el panel scrollea
          // por dentro y en móvil todo el modal scrollea.
          sidebar !== undefined &&
            "w-[min(98vw,1760px)] !max-w-[min(98vw,1760px)] max-h-[96vh] overflow-y-auto md:overflow-hidden",
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description ?? title}</DialogDescription>
        {/* Montado solo con el modal abierto: el estado se reinicia en cada apertura. */}
        <PlayerBody
          title={title}
          source={source}
          defaultVolume={defaultVolume}
          defaultViewport={defaultViewport}
          actions={actions}
          sidebar={sidebar}
          sidebarToggleLabel={sidebarToggleLabel}
          defaultSidebarOpen={defaultSidebarOpen}
        />
      </DialogContent>
    </Dialog>
  );
}

function PlayerBody({
  title,
  source,
  defaultVolume,
  defaultViewport,
  actions,
  sidebar,
  sidebarToggleLabel,
  defaultSidebarOpen,
}: {
  title: string;
  source: MediaSource | null;
  defaultVolume: number;
  defaultViewport: MediaViewport;
  actions?: ReactNode;
  sidebar?: ReactNode;
  sidebarToggleLabel: string;
  defaultSidebarOpen: boolean;
}) {
  const t = useTranslations("mediaPlayer");
  const stageRef = useRef<StageHandle>(null);
  const stageBoxRef = useRef<HTMLDivElement>(null);

  const hasMobile = source?.kind === "iframe" || Boolean(source?.mobileUrl);
  const hasDesktop = source?.kind === "iframe" || Boolean(source?.desktopUrl);
  const [viewport, setViewport] = useState<MediaViewport>(
    defaultViewport === "mobile"
      ? hasMobile
        ? "mobile"
        : "desktop"
      : hasDesktop
        ? "desktop"
        : "mobile",
  );
  const [volume, setVolume] = useState(defaultVolume);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [resumeAt, setResumeAt] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const hasSidebar = sidebar !== undefined;

  // Otra URL de iframe (ej. el Estudio pasa de la plantilla por defecto al
  // preview del draft): es otra reproducción, arranca de cero.
  const iframeUrl = source?.kind === "iframe" ? source.url : null;
  useEffect(() => {
    if (iframeUrl === null) return;
    setTime(0);
    setDuration(0);
    setEnded(false);
    setPlaying(true);
  }, [iframeUrl]);

  const effectiveVolume = muted ? 0 : volume;
  const videoUrl =
    source?.kind === "video"
      ? viewport === "mobile"
        ? source.mobileUrl
        : source.desktopUrl
      : null;

  const handleTime = useRef((current: number, total: number) => {
    if (Number.isFinite(total) && total > 0) setDuration(total);
    if (Number.isFinite(current)) setTime(Math.max(0, current));
  }).current;
  const handleEnded = useRef(() => {
    setPlaying(false);
    setEnded(true);
  }).current;
  const handlePlayingChange = useRef((next: boolean) => {
    setPlaying(next);
    if (next) setEnded(false);
  }).current;
  const handleMutedChange = useRef((next: boolean) => setMuted(next)).current;

  const changeViewport = (next: MediaViewport) => {
    if (next === viewport) return;
    // El MP4 de cada viewport es otro archivo: retoma donde iba el anterior.
    setResumeAt(time);
    setViewport(next);
  };

  const seek = (target: number) => {
    const next = Math.max(0, Math.min(target, duration || Number.POSITIVE_INFINITY));
    setTime(next);
    setEnded(false);
    stageRef.current?.seek(next);
  };

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (ended || (duration > 0 && time >= duration - 0.05)) {
      setEnded(false);
      setTime(0);
      if (source?.kind === "iframe") setDuration(0);
      stageRef.current?.restart();
    }
    setPlaying(true);
  };

  const changeVolume = (value: number) => {
    setVolume(value);
    setMuted(value === 0);
  };

  const toggleMute = () => {
    if (muted || volume === 0) {
      setVolume((current) => (current === 0 ? defaultVolume : current));
      setMuted(false);
      return;
    }
    setMuted(true);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void stageBoxRef.current?.requestFullscreen?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const tag = (event.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (tag === "BUTTON" && (event.key === " " || event.key === "Enter")) return;
    const handlers: Record<string, () => void> = {
      " ": togglePlayback,
      k: togglePlayback,
      ArrowLeft: () => seek(time - 5),
      ArrowRight: () => seek(time + 5),
      m: toggleMute,
      f: toggleFullscreen,
    };
    const handler = handlers[event.key];
    if (!handler) return;
    event.preventDefault();
    handler();
  };

  const stageProps: StageProps = {
    playing,
    volume: effectiveVolume,
    muted,
    onTime: handleTime,
    onEnded: handleEnded,
    onPlayingChange: handlePlayingChange,
    onMutedChange: handleMutedChange,
  };

  const viewportButton = (mode: MediaViewport, label: string, enabled: boolean) => (
    <button
      type="button"
      aria-pressed={viewport === mode}
      disabled={!enabled}
      onClick={() => changeViewport(mode)}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35",
        viewport === mode
          ? "bg-white text-black"
          : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white",
      )}
    >
      {label}
    </button>
  );

  const canPlay = source !== null && (source.kind === "iframe" || videoUrl !== null);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: atajos de teclado del reproductor (espacio, flechas, m, f)
    <div className="flex flex-col gap-2 outline-none" onKeyDown={handleKeyDown}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-1 pr-10">
        <div className="flex min-w-0 items-center gap-2">
          {viewportButton("mobile", t("viewMobile"), hasMobile)}
          {viewportButton("desktop", t("viewDesktop"), hasDesktop)}
          <span className="ml-2 hidden min-w-0 truncate text-[13px] font-semibold text-white/85 md:inline">
            {title}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label={playing ? t("pause") : t("play")}
            aria-pressed={playing}
            onClick={togglePlayback}
            disabled={!canPlay}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-40"
          >
            {playing ? (
              <Pause className="size-3.5" />
            ) : ended ? (
              <RotateCcw className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
            {playing ? t("pause") : ended ? t("replay") : t("play")}
          </button>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-2 py-1">
            <button
              type="button"
              aria-label={muted ? t("unmute") : t("mute")}
              onClick={toggleMute}
              className="text-white/85 transition-colors hover:text-white"
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <input
              aria-label={t("volume")}
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={effectiveVolume}
              onChange={(event) => changeVolume(Number(event.target.value))}
              className="h-1 w-24 cursor-pointer accent-white"
            />
            <span className="min-w-8 text-right text-[10px] font-semibold text-white/70">
              {Math.round(effectiveVolume * 100)}%
            </span>
          </div>
          <button
            type="button"
            aria-label={t("fullscreen")}
            onClick={toggleFullscreen}
            className="flex size-7 items-center justify-center rounded-full bg-white/10 text-white/85 transition-colors hover:bg-white/20 hover:text-white"
          >
            <Maximize2 className="size-3.5" />
          </button>
          {actions}
          {hasSidebar && (
            <button
              type="button"
              aria-label={sidebarToggleLabel}
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((v) => !v)}
              className={cn(
                "flex size-7 items-center justify-center rounded-full transition-colors",
                sidebarOpen
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/85 hover:bg-white/20 hover:text-white",
              )}
            >
              <Menu className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className={cn(hasSidebar && "flex flex-col gap-2 md:flex-row md:items-stretch")}>
        <div className={cn(hasSidebar && "flex min-w-0 flex-1 flex-col gap-2")}>
          {canPlay ? (
            <div
              ref={stageBoxRef}
              className={cn(
                "mx-auto max-w-full overflow-hidden rounded-[18px] bg-black transition-[width,height] duration-200",
                viewport === "mobile" ? "max-h-[74vh] w-[min(390px,88vw)]" : "max-h-[74vh] w-full",
              )}
              style={{ aspectRatio: viewport === "mobile" ? "9 / 16" : "16 / 9" }}
            >
              {source.kind === "iframe" ? (
                <IframeStage ref={stageRef} url={source.url} title={title} {...stageProps} />
              ) : (
                videoUrl && (
                  <VideoStage
                    key={videoUrl}
                    ref={stageRef}
                    url={videoUrl}
                    startAt={resumeAt}
                    errorLabel={t("loadError")}
                    {...stageProps}
                  />
                )
              )}
            </div>
          ) : (
            <p className="p-10 text-center text-sm text-white/70">{t("unavailable")}</p>
          )}

          {canPlay && (
            <div className="space-y-2 px-2 pb-1">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-white/65">
                <span className="w-10 text-right tabular-nums">{formatTime(time)}</span>
                <input
                  aria-label={t("progress")}
                  type="range"
                  min="0"
                  max={Math.max(duration, 0.1)}
                  step="0.1"
                  value={Math.min(time, duration)}
                  onChange={(event) => seek(Number(event.target.value))}
                  disabled={duration <= 0}
                  className="h-1 min-w-0 flex-1 cursor-pointer accent-white"
                />
                <span className="w-10 tabular-nums">{formatTime(duration)}</span>
              </div>
              <div className="relative flex items-center justify-center gap-2">
                <button
                  type="button"
                  aria-label={t("skipBack")}
                  onClick={() => seek(time - 5)}
                  className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                >
                  −5s
                </button>
                <button
                  type="button"
                  aria-label={t("skipForward")}
                  onClick={() => seek(time + 5)}
                  className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                >
                  +5s
                </button>
                <span className="absolute right-0 hidden text-[10px] text-white/40 lg:inline">
                  {t("shortcutsHint")}
                </span>
              </div>
            </div>
          )}
        </div>
        {/* Cerrado se oculta pero sigue montado: así no se pierde lo que el
            panel tenga en curso (una búsqueda de stock, un plan de la IA). */}
        {hasSidebar && (
          <aside
            hidden={!sidebarOpen}
            className={cn(
              "relative max-h-[70vh] min-h-80 w-full flex-col overflow-hidden rounded-[18px] bg-nb-surface text-nb-ink md:max-h-[calc(96vh-4.5rem)] md:w-[22%] md:min-w-75 md:shrink-0",
              sidebarOpen ? "flex" : "hidden",
            )}
          >
            {/* En escritorio el contenido va en una capa absoluta: el panel toma la altura
                del reproductor y scrollea por dentro, en vez de estirar todo el modal
                cuando el contenido es largo (textos de publicación, formularios). */}
            <div className="flex min-h-0 flex-1 flex-col md:absolute md:inset-0">{sidebar}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
