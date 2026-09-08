import { Play } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import "./RadialWheel.css";

export interface RadialWheelItem {
  id: string;
  label: string;
  /** URL de video pública (mp4) — opcional. Si no viene, la tarjeta cae al
   * ícono de play + label, como antes. */
  videoUrl?: string;
}

interface RadialWheelProps {
  items: RadialWheelItem[];
  className?: string;
}

/** Ángulo fijo de una tarjeta en el círculo — generaliza los pasos de 15°
 * (24 tarjetas) del prototipo a cualquier cantidad de items. */
export function angleForIndex(index: number, total: number): number {
  return (360 / total) * index;
}

/** Repite un set base N veces — así el llamador (ej. PlayReel) solo define
 * 8 labels únicos y la rueda igual queda con densidad visual (24 tarjetas).
 * Sufija el `id` de cada repetición (`-r0`, `-r1`, …) para que cada copia
 * tenga una key de React estable y única sin depender del índice de render. */
export function repeatItems<T extends { id: string }>(base: T[], times: number): T[] {
  return Array.from({ length: times }, (_, rep) =>
    base.map((item) => ({ ...item, id: `${item.id}-r${rep}` })),
  ).flat();
}

/**
 * Carrusel radial giratorio real — técnica de "manecilla de reloj": cada
 * tarjeta se posiciona con `rotate(var(--a)) translateY(-radio)` (ver
 * ./RadialWheel.css), y todo el
 * conjunto gira sin parar vía @keyframes en `.nr-wheel__spin`. Puramente
 * decorativo (`aria-hidden`) — el radio/alto/ancho de tarjeta se controlan
 * desde las variables `--nr-radius`/`--nr-lift`/`--nr-item-w` en CSS, no
 * como props, para que el breakpoint mobile los pueda reajustar sin JS.
 */
export function RadialWheel({ items, className }: RadialWheelProps) {
  return (
    <div className={cn("nr-wheel", className)} aria-hidden="true">
      <div className="nr-wheel__spin">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="nr-wheel__item"
            style={{ "--a": `${angleForIndex(index, items.length)}deg` } as React.CSSProperties}
          >
            <div className="nr-wheel__card">
              <div className="nr-wheel__card-visual">
                {item.videoUrl ? (
                  <video
                    className="nr-wheel__card-video"
                    src={item.videoUrl}
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <Play size={20} fill="currentColor" style={{ opacity: 0.55 }} />
                )}
              </div>
              <p className="nr-wheel__card-p">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
