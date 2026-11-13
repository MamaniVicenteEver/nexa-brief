"use client";

import { useEffect, useRef, useState } from "react";
import { decodeStageMessage, playbackCommand, seekCommand } from "../lib/messages";
import type { PlayerStatus } from "../hooks/useStagePlayer";
import { StagePlayer, StagePlayerControls } from "./StagePlayer";

/** El puente de Proto comparte comandos con Stage, pero no envía kit-stage-component. */
export function SandboxPrototypePlayer({
  load,
  title,
  format,
}: {
  load(): Promise<string>;
  title: string;
  format: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [time, setTime] = useState(0);
  const [totalTime, setTotalTime] = useState(6);
  const frameRef = useRef<HTMLIFrameElement>(null);
  // La función pertenece a la tarjeta con la que se montó este reproductor.
  const loader = useRef(load);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision inicia una sesión nueva del reproductor.
  useEffect(() => {
    let disposed = false;
    setSrc(null);
    setError("");
    setStatus("loading");
    setTime(0);
    void loader.current().then(
      (url) => {
        if (!disposed) setSrc(url);
      },
      (reason) => {
        if (!disposed)
          setError(reason instanceof Error ? reason.message : "No se pudo cargar la vista previa.");
      },
    );
    return () => {
      disposed = true;
    };
  }, [revision]);
  useEffect(() => {
    if (!src) return;
    const origin = new URL(src, window.location.href).origin;
    let ready = false;
    const timer = window.setTimeout(() => setStatus("error"), 30_000);
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frameRef.current?.contentWindow) return;
      const message = decodeStageMessage(event.data);
      if (!message) return;
      if (message.type === "nexa-template-ready" && !ready) {
        ready = true;
        window.clearTimeout(timer);
        setStatus("playing");
        frameRef.current?.contentWindow?.postMessage(playbackCommand(true), origin);
      } else if (message.type === "nexa-template-time") {
        setTime(message.currentTime);
        setTotalTime(message.duration);
      } else if (ready && message.type === "nexa-template-state")
        setStatus(message.playing ? "playing" : "paused");
      else if (ready && message.type === "nexa-template-ended") setStatus("ended");
    };
    window.addEventListener("message", receive);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", receive);
    };
  }, [src]);
  const send = (command: ReturnType<typeof playbackCommand> | ReturnType<typeof seekCommand>) => {
    if (src)
      frameRef.current?.contentWindow?.postMessage(
        command,
        new URL(src, window.location.href).origin,
      );
  };
  const replay = () => {
    send(seekCommand(0));
    send(playbackCommand(true));
    setStatus("playing");
    setTime(0);
  };
  return (
    <section aria-label="Reproductor del prototipo" className="min-w-0 space-y-3">
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button type="button" onClick={() => setRevision((value) => value + 1)}>
            Reintentar
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <StagePlayerControls
              status={status}
              onPlayPause={() => {
                if (status === "ended") replay();
                else {
                  send(playbackCommand(status !== "playing"));
                  setStatus(status === "playing" ? "paused" : "playing");
                }
              }}
              onReplay={replay}
              onRetry={() => setRevision((value) => value + 1)}
            />
          </div>
          {src ? (
            <div
              className="[&_iframe]:pointer-events-none"
              onLoadCapture={() => frameRef.current?.setAttribute("tabindex", "-1")}
            >
              <StagePlayer
                frameRef={frameRef}
                frameKey={revision}
                src={src}
                title={`Vista ampliada de ${title}`}
                status={status}
                format={format === "9x16" ? "9x16" : "16x9"}
                time={time}
                totalTime={totalTime}
                onSeek={(value) => {
                  const next = Math.max(0, Math.min(value, totalTime));
                  send(seekCommand(next));
                  setTime(next);
                  if (status === "ended") setStatus("paused");
                }}
              />
            </div>
          ) : (
            <p role="status">Cargando vista previa…</p>
          )}
        </>
      )}
    </section>
  );
}
