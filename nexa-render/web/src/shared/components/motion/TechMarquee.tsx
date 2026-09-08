import { cn } from "@/shared/lib/utils";
import "./TechMarquee.css";

interface TechMarqueeProps {
  items: string[];
  className?: string;
}

/**
 * Ticker de fondo (decorativo, `aria-hidden`) para mostrar el stack
 * tecnológico completo detrás de una sección — a diferencia de `Marquee`
 * (la barra sólida del nav, todo el mismo tamaño), acá cada palabra recibe
 * un tamaño y una tipografía distintos (`SIZE_CLASSES`/`FONT_CLASSES`,
 * cíclico por índice) — pedido explícito: "diferentes tipografía
 * diferentes tamaños". `pointer-events: none` + z-index bajo porque este
 * componente vive DETRÁS de contenido real (labels, tarjetas) en las
 * secciones que lo usan; nunca debe taparlas ni ser clickeable.
 */
const SIZE_CLASSES = ["is-xs", "is-sm", "is-md", "is-lg", "is-xl"];
const FONT_CLASSES = ["is-sans", "is-mono", "is-script"];

export function TechMarquee({ items, className }: TechMarqueeProps) {
  const doubled = [...items, ...items];

  return (
    <div className={cn("nr-tech-marquee", className)} aria-hidden="true">
      <div className="nr-tech-marquee__track">
        {doubled.map((text, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: lista estática, puramente decorativa, nunca se reordena
            key={index}
            className={cn(
              "nr-tech-marquee__item",
              SIZE_CLASSES[index % SIZE_CLASSES.length],
              FONT_CLASSES[index % FONT_CLASSES.length],
            )}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
