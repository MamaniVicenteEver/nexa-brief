"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MediaPlayerModal } from "@/shared/components/media/MediaPlayerModal";
import type { CatalogItem, TileLive } from "./catalog-items";

const PREVIEW_VOLUME = 0.05;

/** Explainer (player.js): reproducir en silencio. */
function startExplainer(frame: HTMLIFrameElement | null) {
  const target = frame?.contentWindow;
  target?.postMessage({ type: "nexa-template-volume", volume: 0, muted: true }, "*");
  target?.postMessage({ type: "nexa-template-playback", playing: true }, "*");
}

/** Lo que corre encima de la portada mientras el mouse está en la tarjeta.
 * Se monta al entrar y se desmonta al salir: así solo hay un video/plantilla vivo
 * a la vez y la portada vuelve tal cual. Aparece con un fundido cuando ya tiene
 * imagen, para no mostrar el negro de carga. */
function LivePreview({ live, title }: { live: TileLive; title: string }) {
  const [shown, setShown] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const fade = cn(
    "pointer-events-none absolute inset-0 size-full border-0 transition-opacity duration-300",
    shown ? "opacity-100" : "opacity-0",
  );

  // El explainer avisa nexa-template-ready cuando ya escucha: ahí se le pide
  // reproducir en silencio (puede llegar antes o después del load del iframe).
  useEffect(() => {
    if (live.kind !== "explainer") return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const type = event.data?.type;
      if (type === "nexa-template-ready") startExplainer(frameRef.current);
      if (type === "nexa-template-time" && event.data.currentTime > 0.1) setShown(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [live.kind]);

  const post = (message: object) => frameRef.current?.contentWindow?.postMessage(message, "*");

  if (live.kind === "video") {
    return (
      <video
        src={live.url}
        muted
        autoPlay
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
        onPlaying={() => setShown(true)}
        className={cn(fade, "object-cover")}
      />
    );
  }
  return (
    <iframe
      ref={frameRef}
      src={live.url}
      title={title}
      aria-hidden="true"
      tabIndex={-1}
      onLoad={() => {
        if (live.kind === "template") {
          post({ type: "nexa-template-reset" });
          post({ type: "nexa-template-preview", playing: true });
          // La plantilla no avisa cuándo pinta: se le da un instante.
          setTimeout(() => setShown(true), 350);
        } else {
          startExplainer(frameRef.current);
        }
      }}
      className={cn(fade, "bg-black")}
    />
  );
}

/** Tarjeta del catálogo de la landing: solo la portada; con el mouse encima
 * reproduce la plantilla y muestra un pie translúcido con tipo, nombre y etiquetas.
 * Al tocarla abre el reproductor grande (el mismo modal de siempre). */
export function CatalogTile({
  item,
  width,
  hint,
}: {
  item: CatalogItem;
  width: number;
  /** Texto bajo el título del modal. */
  hint?: string;
}) {
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const preview = item.shape === "tall" ? (item.liveTall ?? item.live) : item.live;
  const live = hover && !open ? preview : null;

  const trigger = (
    <button
      type="button"
      aria-label={`${item.kind} · ${item.title}`}
      className="group relative block size-full cursor-pointer overflow-hidden rounded-[10px] bg-nb-bg-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-nb-ink/60"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHover(true);
      }}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      {item.poster ? (
        <Image
          src={item.poster}
          alt=""
          fill
          draggable={false}
          sizes={`${width}px`}
          unoptimized
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
      ) : null}
      {live ? <LivePreview live={live} title={item.title} /> : null}

      <div
        className={cn(
          "pointer-events-none absolute inset-x-1.5 bottom-1.5 flex items-end justify-between gap-2 rounded-[8px] px-2.5 py-1.5",
          "bg-black/30 text-white shadow-[0_6px_18px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-md",
          "translate-y-1 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100",
        )}
      >
        <div className="min-w-0">
          <p className="truncate text-[8.5px] font-semibold tracking-[0.12em] text-white/70 uppercase">
            {item.kind}
          </p>
          <p className="truncate text-[12px] leading-tight font-semibold tracking-[-0.01em]">
            {item.title}
          </p>
        </div>
        {item.tags.length > 0 && item.shape === "wide" ? (
          <div className="flex shrink-0 gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/15 px-1.5 py-px text-[8.5px] font-medium text-white/85"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );

  return (
    <MediaPlayerModal
      open={open}
      onOpenChange={setOpen}
      title={item.title}
      description={hint}
      defaultVolume={PREVIEW_VOLUME}
      defaultViewport={item.shape === "tall" ? "mobile" : "desktop"}
      source={item.modal}
      trigger={trigger}
    />
  );
}
