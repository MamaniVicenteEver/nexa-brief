"use client";

import { useEffect, useRef, useState } from "react";

/** El puente espera una orden explícita incluso cuando se abre desde una tarjeta. */
export function SandboxCardPreview({
  src,
  title,
  format,
}: {
  src: string;
  title: string;
  format: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const origin = new URL(src, window.location.href).origin;
    setFailed(false);
    const timeout = window.setTimeout(() => setFailed(true), 30_000);
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== origin) return;
      if (event.data?.type !== "nexa-template-ready") return;
      window.clearTimeout(timeout);
      frame.current?.contentWindow?.postMessage(
        { type: "nexa-template-volume", muted: true, volume: 0 },
        origin,
      );
      frame.current?.contentWindow?.postMessage(
        { type: "nexa-template-playback", playing: true },
        origin,
      );
    };
    window.addEventListener("message", receive);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
  }, [src]);
  return (
    <>
      <iframe
        ref={frame}
        title={title}
        src={src}
        className="pointer-events-none h-full max-w-full border-0"
        style={{ aspectRatio: format === "9x16" ? "9 / 16" : "16 / 9" }}
      />
      {failed && (
        <p
          role="alert"
          className="absolute inset-0 grid place-items-center bg-black/90 p-4 text-center"
        >
          No se pudo iniciar la vista previa. Vuelve a abrir la tarjeta.
        </p>
      )}
    </>
  );
}
