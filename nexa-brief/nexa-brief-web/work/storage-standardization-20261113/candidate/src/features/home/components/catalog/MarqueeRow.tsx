"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import type { CatalogItem } from "./catalog-items";

export const TILE_GAP = 5;
const DRAG_THRESHOLD = 5;
/** Con menos tarjetas que esto la fila no gira (se notaría la repetición). */
const MIN_LOOP_ITEMS = 4;

export function tileWidth(item: CatalogItem, height: number) {
  return Math.round(item.shape === "tall" ? (height * 9) / 16 : (height * 16) / 9);
}

/** Desplazamiento dentro de (-block, 0]: al pasar un bloque entero se vuelve al
 * otro extremo sin salto (el bloque está dibujado dos veces). 0 si no gira. */
function wrapOffset(value: number, block: number) {
  if (block <= 0) return 0;
  const v = value % block;
  return v > 0 ? v - block : v;
}

function paintTrack(track: HTMLElement | null, x: number) {
  if (track) track.style.transform = `translate3d(${x}px,0,0)`;
}

/** Fila infinita que avanza sola de izquierda a derecha y se puede arrastrar con
 * el mouse (o el dedo). Se mueve con transform en un rAF, sin re-renderizar React.
 * Se pausa con el mouse encima o con foco, y respeta prefers-reduced-motion.
 * Las tarjetas se repiten lo justo para cubrir el ancho: solo muestran su imagen,
 * así que repetirlas no pesa. */
export function MarqueeRow({
  items,
  height,
  speed,
  label,
  renderItem,
}: {
  items: CatalogItem[];
  height: number;
  /** px por segundo hacia la derecha. */
  speed: number;
  label: string;
  renderItem: (item: CatalogItem, width: number) => ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const x = useRef(0);
  const paused = useRef(false);
  const drag = useRef<{ startX: number; startPos: number; moved: boolean; id: number } | null>(
    null,
  );
  const suppressClick = useRef(false);

  const setWidth = items.reduce((sum, item) => sum + tileWidth(item, height) + TILE_GAP, 0);
  const loops = items.length >= MIN_LOOP_ITEMS && setWidth > 0;
  const reps = loops ? Math.max(1, Math.ceil(viewportWidth / setWidth)) : 1;
  const block = loops ? setWidth * reps : 0;
  const copies = loops ? reps * 2 : 1;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const moveTo = (value: number) => {
    x.current = wrapOffset(value, block);
    paintTrack(trackRef.current, x.current);
  };

  // Arranque y avance automático.
  useEffect(() => {
    x.current = wrapOffset(-block / 2, block);
    paintTrack(trackRef.current, x.current);
    if (block <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!paused.current && !drag.current) {
        x.current = wrapOffset(x.current + speed * dt, block);
        paintTrack(trackRef.current, x.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [block, speed]);

  // Rueda horizontal (trackpad): mueve la fila sin bloquear el scroll vertical de la página.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || block <= 0) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      x.current = wrapOffset(x.current - event.deltaX, block);
      paintTrack(trackRef.current, x.current);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [block]);

  const onPointerDown = (event: React.PointerEvent) => {
    if (!loops || event.button !== 0) return;
    drag.current = {
      startX: event.clientX,
      startPos: x.current,
      moved: false,
      id: event.pointerId,
    };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!d.moved) {
      d.moved = true;
      viewportRef.current?.setPointerCapture(d.id);
    }
    moveTo(d.startPos + dx);
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    // El click que sigue a un arrastre no abre la tarjeta.
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: arrastre opcional; las tarjetas siguen siendo botones con foco
    <div
      ref={viewportRef}
      className="relative overflow-hidden"
      style={{ height, touchAction: "pan-y" }}
      onPointerEnter={() => {
        paused.current = true;
      }}
      onPointerLeave={() => {
        paused.current = false;
      }}
      onFocus={() => {
        paused.current = true;
      }}
      onBlur={() => {
        paused.current = false;
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onDragStart={(event) => event.preventDefault()}
    >
      <ul
        ref={trackRef}
        aria-label={label}
        className={loops ? "flex w-max will-change-transform" : "flex w-full justify-center"}
        style={{ gap: TILE_GAP, paddingRight: loops ? TILE_GAP : 0 }}
      >
        {Array.from({ length: copies }, (_, copy) =>
          items.map((item) => {
            const width = tileWidth(item, height);
            return (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: cada copia del bloque es fija (no se reordena)
                key={`${copy}:${item.key}`}
                className="shrink-0"
                style={{ width, height }}
              >
                {renderItem(item, width)}
              </li>
            );
          }),
        )}
      </ul>
    </div>
  );
}
