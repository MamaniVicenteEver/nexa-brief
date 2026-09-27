"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { TemplateCard } from "@/features/templates/components/TemplateCard";
import { useTemplates } from "@/features/templates/hooks/useTemplates";
import type { Template } from "@/features/templates/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const CARD_WIDTH = 300;
const GAP = 12;
const SPEED_PX_PER_SECOND = 22;

/** Fila que avanza sola y rebota en los extremos (sin duplicar tarjetas: cada
 * TemplateCard es un iframe con la plantilla real, duplicarlas duplicaría la
 * carga). Se pausa con hover/foco y respeta prefers-reduced-motion. */
function AutoScrollRow({
  templates,
  direction,
  label,
}: {
  templates: Template[];
  direction: 1 | -1;
  label: string;
}) {
  const t = useTranslations("templatesRow");
  const trackRef = useRef<HTMLUListElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  // Pausa mientras el usuario mira/navega la fila (mouse o teclado).
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const pause = () => {
      pausedRef.current = true;
    };
    const resume = () => {
      pausedRef.current = false;
    };
    row.addEventListener("pointerenter", pause);
    row.addEventListener("pointerleave", resume);
    row.addEventListener("focusin", pause);
    row.addEventListener("focusout", resume);
    return () => {
      row.removeEventListener("pointerenter", pause);
      row.removeEventListener("pointerleave", resume);
      row.removeEventListener("focusin", pause);
      row.removeEventListener("focusout", resume);
    };
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let dir = direction;
    let last = performance.now();
    let frame = 0;
    // La fila que va hacia la izquierda arranca desde el final.
    if (dir === -1) track.scrollLeft = track.scrollWidth;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!pausedRef.current) {
        const max = track.scrollWidth - track.clientWidth;
        const next = track.scrollLeft + dir * SPEED_PX_PER_SECOND * dt;
        if (next >= max) dir = -1;
        if (next <= 0) dir = 1;
        track.scrollLeft = Math.max(0, Math.min(max, next));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [direction]);

  const step = (sign: 1 | -1) =>
    trackRef.current?.scrollBy({ left: sign * (CARD_WIDTH + GAP) * 2, behavior: "smooth" });

  return (
    <div ref={rowRef} className="group/row relative">
      <ul
        ref={trackRef}
        aria-label={label}
        className="flex gap-3 overflow-x-auto px-6 py-2 [scrollbar-width:none] md:px-10 [&::-webkit-scrollbar]:hidden"
      >
        {templates.map((template) => (
          <li key={template.id} className="shrink-0" style={{ width: CARD_WIDTH }}>
            <TemplateCard template={template} hideRecorder />
          </li>
        ))}
      </ul>
      {/* Bordes que desvanecen + flechas (visibles al pasar el mouse) */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-nb-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-nb-bg to-transparent" />
      {([-1, 1] as const).map((sign) => (
        <button
          key={sign}
          type="button"
          onClick={() => step(sign)}
          aria-label={sign === -1 ? t("previous") : t("next")}
          className={cn(
            "absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-nb-surface/90 text-nb-ink opacity-0 shadow-[0_10px_20px_-8px_rgba(40,30,10,0.35)] backdrop-blur transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100",
            sign === -1 ? "left-3" : "right-3",
          )}
        >
          {sign === -1 ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
        </button>
      ))}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex gap-3 overflow-hidden px-6 py-2 md:px-10">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: skeletons estáticos sin identidad
          key={i}
          className="aspect-[1.65] shrink-0 animate-pulse rounded-[10px] bg-nb-bg-2"
          style={{ width: CARD_WIDTH }}
        />
      ))}
    </div>
  );
}

export function TemplatesCarousel() {
  const t = useTranslations("templatesRow");
  const { data: templates, isLoading } = useTemplates();
  const all = templates ?? [];
  // Reparto alternado: las dos filas quedan parejas y mezclan géneros.
  const rows = [all.filter((_, i) => i % 2 === 0), all.filter((_, i) => i % 2 === 1)];

  return (
    <section className="nexa-home-templates relative z-[5] pt-[70px] pb-8">
      <div className="mx-auto mb-7 flex max-w-[1280px] flex-wrap items-end justify-between gap-4 px-6 md:px-10">
        <div>
          <p className="nb-eyebrow mb-3">{t("eyebrow")}</p>
          <h2 className="font-nb-sans text-[clamp(26px,3.4vw,42px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-nb-ink">
            {t("heading")}
          </h2>
          <p className="mt-2 max-w-[520px] text-[14.5px] leading-[1.55] text-nb-ink-soft">
            {t("subheading")}
          </p>
        </div>
        <Link
          href="/plantillas"
          className="nb-btn-secondary inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-semibold no-underline"
        >
          {all.length > 0 ? t("seeAllCount", { count: all.length }) : t("seeAll")}
          <ChevronRight className="size-4" />
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          rows.map((row, index) =>
            row.length ? (
              <AutoScrollRow
                key={index === 0 ? "top" : "bottom"}
                templates={row}
                direction={index === 0 ? 1 : -1}
                label={t("heading")}
              />
            ) : null,
          )
        )}
      </div>
    </section>
  );
}
