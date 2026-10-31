"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { getDesignGroups } from "@/features/explainer/api/explainer-service";
import { useTemplates } from "@/features/templates/hooks/useTemplates";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { CatalogTile } from "./catalog/CatalogTile";
import {
  assignShapes,
  type CatalogItem,
  designItems,
  interleaveByBrand,
  MOTION_BRAND,
  templateItems,
} from "./catalog/catalog-items";
import { MarqueeRow, TILE_GAP } from "./catalog/MarqueeRow";

const ALL = "all";
/** Velocidad de cada fila (px/s, hacia la derecha): distintas para que no vayan en bloque. */
const ROW_SPEEDS = [24, 16];
/** Con pocas tarjetas una sola fila se ve mejor que dos medio vacías. */
const MIN_ITEMS_FOR_TWO_ROWS = 8;

function rowHeightFor(width: number) {
  if (width < 640) return 190;
  if (width < 1024) return 230;
  return 270;
}

function useRowHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(270);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setHeight(rowHeightFor(entry.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, height };
}

export function TemplatesCarousel() {
  const t = useTranslations("templatesRow");
  const tCard = useTranslations("templates");
  const { data: templates, isLoading } = useTemplates();
  const { data: groups } = useQuery({
    queryKey: ["explainer-design-groups", "landing"],
    queryFn: ({ signal }) => getDesignGroups("", signal),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const [brand, setBrand] = useState(ALL);
  const { ref, height } = useRowHeight();

  const items = useMemo(() => {
    const tags = {
      image: tCard("card.tagImage"),
      video: tCard("card.tagVideo"),
      lyrics: tCard("card.tagLyrics"),
      narrated: t("tagNarrated"),
    };
    return interleaveByBrand([
      ...templateItems(templates ?? [], tags),
      ...designItems(groups ?? [], tags),
    ]);
  }, [templates, groups, t, tCard]);

  const brands = useMemo(() => {
    const present = new Set(items.map((item) => item.brand));
    return [MOTION_BRAND, ...[...present].filter((b) => b !== MOTION_BRAND).sort()].filter((b) =>
      present.has(b),
    );
  }, [items]);

  const visible = brand === ALL ? items : items.filter((item) => item.brand === brand);
  const rows: CatalogItem[][] =
    visible.length >= MIN_ITEMS_FOR_TWO_ROWS
      ? [
          assignShapes(visible.filter((_, i) => i % 2 === 0)),
          assignShapes(visible.filter((_, i) => i % 2 === 1)),
        ]
      : [assignShapes(visible)];

  return (
    <section className="nexa-home-templates relative z-[5] pt-[70px] pb-8">
      <div className="mx-auto mb-6 flex max-w-[1280px] flex-wrap items-end justify-between gap-x-6 gap-y-4 px-6 md:px-10">
        <div>
          <h2 className="font-nb-sans text-[clamp(26px,3.4vw,42px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-nb-ink">
            {t("heading")}
          </h2>
          <p className="mt-2 max-w-[520px] text-[14.5px] leading-[1.55] text-nb-ink-soft">
            {t("subheading")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {brands.length > 1 ? (
            <div role="tablist" aria-label={t("filterLabel")} className="flex flex-wrap gap-1">
              {[ALL, ...brands].map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={brand === key}
                  onClick={() => setBrand(key)}
                  className={cn(
                    "cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors",
                    brand === key
                      ? "bg-nb-ink text-nb-bg"
                      : "text-nb-ink-soft hover:bg-nb-bg-2 hover:text-nb-ink",
                  )}
                >
                  {key === ALL ? t("filterAll") : key}
                </button>
              ))}
            </div>
          ) : null}
          <Link
            href="/plantillas"
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-nb-ink no-underline opacity-70 transition-opacity hover:opacity-100"
          >
            {t("seeAll")}
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </div>

      <div ref={ref} className="relative flex flex-col" style={{ gap: TILE_GAP }}>
        {isLoading && !items.length
          ? [0, 1].map((row) => (
              <div key={row} className="flex overflow-hidden" style={{ gap: TILE_GAP, height }}>
                {Array.from({ length: 8 }, (_, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: esqueletos sin identidad
                    key={i}
                    className="shrink-0 animate-pulse rounded-[10px] bg-nb-bg-2"
                    style={{ height, width: i % 5 === 3 ? (height * 9) / 16 : (height * 16) / 9 }}
                  />
                ))}
              </div>
            ))
          : rows.map((row, index) => (
              <MarqueeRow
                // biome-ignore lint/suspicious/noArrayIndexKey: las filas son posiciones fijas; se rearman al cambiar de filtro
                key={`${brand}:${index}`}
                items={row}
                height={height}
                speed={ROW_SPEEDS[index] ?? ROW_SPEEDS[0]}
                label={t("heading")}
                renderItem={(item, width) => (
                  <CatalogTile item={item} width={width} hint={tCard("card.previewHint")} />
                )}
              />
            ))}
        {/* Bordes que desvanecen */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-nb-bg to-transparent md:w-16" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-nb-bg to-transparent md:w-16" />
      </div>
    </section>
  );
}
