import { cn } from "@/shared/lib/utils";
import "./Marquee.css";

interface MarqueeProps {
  items: string[];
  separator?: string;
  className?: string;
}

/**
 * Ticker horizontal infinito. Equivalente funcional del
 * `track.innerHTML += track.innerHTML` imperativo del script original:
 * acá el array se duplica de forma declarativa (sin escritura directa al
 * DOM), y la segunda copia lleva `aria-hidden` — corrección menor que el
 * original no tenía (un lector de pantalla no debería anunciar el loop
 * dos veces).
 */
export function Marquee({ items, separator = "✱", className }: MarqueeProps) {
  const withSeparators = items.flatMap((item) => [item, separator]);
  const doubled = [...withSeparators, ...withSeparators];

  return (
    <div className={cn("nr-marquee", className)}>
      <div className="nr-marquee__track">
        {doubled.map((text, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: lista estática, puramente decorativa, nunca se reordena
            key={index}
            className="nr-marquee__item"
            aria-hidden={index >= withSeparators.length ? true : undefined}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
