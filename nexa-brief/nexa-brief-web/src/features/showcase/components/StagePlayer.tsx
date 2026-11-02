import { Pause, Play, RotateCcw } from "lucide-react";
import type { RefObject } from "react";
import type { PlayerStatus } from "../hooks/useStagePlayer";
import type { FormatId } from "../types";
import { IconAction } from "./IconAction";

type ControlsProps = {
  status: PlayerStatus;
  onPlayPause(): void;
  onReplay(): void;
  onRetry(): void;
};

export function StagePlayerControls({ status, onPlayPause, onReplay, onRetry }: ControlsProps) {
  const disabled = status === "loading" || status === "error";
  const label = status === "playing" ? "Pausar" : "Reanudar";
  return (
    <>
      <button
        type="button"
        onClick={onPlayPause}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-40"
      >
        {status === "playing" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        {label}
      </button>
      <IconAction
        label="Repetir animación"
        onClick={onReplay}
        disabled={disabled}
        className="size-7 bg-white/10 text-white/85 hover:bg-white/20"
      >
        <RotateCcw />
      </IconAction>
      {status === "error" && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs"
        >
          Reintentar
        </button>
      )}
    </>
  );
}

type PlayerProps = {
  frameRef: RefObject<HTMLIFrameElement | null>;
  src: string;
  title: string;
  status: PlayerStatus;
  format: FormatId;
  frameKey: number;
  time: number;
  totalTime: number;
  onSeek(time: number): void;
};

function formatTime(time: number) {
  const seconds = Math.max(0, Math.floor(time));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function StagePlayer({
  frameRef,
  src,
  title,
  status,
  format,
  frameKey,
  time,
  totalTime,
  onSeek,
}: PlayerProps) {
  return (
    <>
      <div
        className={`relative mx-auto max-w-full overflow-hidden rounded-[18px] bg-black transition-[width,height] duration-200 ${format === "9x16" ? "max-h-[74vh] w-[min(390px,88vw,41.625vh)]" : "max-h-[74vh] w-full"}`}
        style={{ aspectRatio: format === "9x16" ? "9 / 16" : "16 / 9" }}
      >
        <iframe
          key={frameKey}
          ref={frameRef}
          src={src}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
        />
        {status === "loading" && (
          <p
            role="status"
            className="pointer-events-none absolute inset-0 grid place-items-center bg-black text-sm text-white/65"
          >
            Cargando vista previa…
          </p>
        )}
      </div>
      <div className="space-y-2 px-2 pb-1">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-white/65">
          <span className="w-10 text-right tabular-nums">{formatTime(time)}</span>
          <input
            aria-label="Progreso de reproducción"
            type="range"
            min="0"
            max={totalTime}
            step="0.1"
            value={Math.min(time, totalTime)}
            onChange={(event) => onSeek(Number(event.target.value))}
            disabled={status === "loading" || status === "error"}
            className="h-1 min-w-0 flex-1 cursor-pointer accent-white"
          />
          <span className="w-10 tabular-nums">{formatTime(totalTime)}</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            aria-label="Retroceder 5 segundos"
            disabled={status === "loading" || status === "error"}
            onClick={() => onSeek(time - 5)}
            className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/20 disabled:opacity-40"
          >
            −5s
          </button>
          <button
            type="button"
            aria-label="Adelantar 5 segundos"
            disabled={status === "loading" || status === "error"}
            onClick={() => onSeek(time + 5)}
            className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/20 disabled:opacity-40"
          >
            +5s
          </button>
        </div>
      </div>
      <p
        role={status === "error" ? "alert" : "status"}
        className={status === "error" ? "px-2 py-1 text-center text-xs text-white/65" : "sr-only"}
      >
        {status === "loading"
          ? "Preparando animación…"
          : status === "error"
            ? "No se pudo cargar la vista previa. Prueba nuevamente."
            : status === "ended"
              ? "Reproducción finalizada."
              : status === "paused"
                ? "En pausa."
                : "En reproducción."}
      </p>
    </>
  );
}
