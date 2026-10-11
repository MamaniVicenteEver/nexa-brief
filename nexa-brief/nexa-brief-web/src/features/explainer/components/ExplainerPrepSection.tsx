"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useExplainerVideos } from "../hooks/useExplainer";
import { ExplainerVideoCard } from "./ExplainerVideoCard";

/** Videos del explainer como tarjetas (igual que las plantillas de NodeMotion):
 * vista previa al pasar el mouse y, al hacer clic, el modal con el reproductor,
 * los textos de publicación y las acciones. Con `categoryPath`, solo esa categoría. */
export function ExplainerPrepSection({ categoryPath }: { categoryPath?: string } = {}) {
  const t = useTranslations("templates");
  const { data: videos = [], isLoading } = useExplainerVideos(categoryPath);
  const [filter, setFilter] = useState<string>("all");

  const designs = [...new Map(videos.map((v) => [v.design, v.designName || v.design])).entries()];
  const hasDemos = videos.some((v) => v.demo);
  const visible = videos
    .filter((v) => (filter === "all" ? true : filter === "demos" ? v.demo : v.design === filter))
    // primero los videos reales, después los demos de diseño
    .sort((a, b) => Number(a.demo) - Number(b.demo) || a.title.localeCompare(b.title));

  const chip = (id: string, label: string, count: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      aria-pressed={filter === id}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        filter === id
          ? "border-nb-ink bg-nb-ink text-[#fafaf7]"
          : "border-nb-line text-nb-ink-soft hover:border-nb-ink"
      }`}
    >
      {label} · {count}
    </button>
  );

  return (
    <section aria-labelledby="explainer-prep-heading" className="mb-12">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2
          id="explainer-prep-heading"
          className="font-nb-sans text-[20px] font-extrabold tracking-[-0.02em] text-nb-ink"
        >
          {t("prep.heading")}
        </h2>
        <span className="text-xs text-nb-mute">
          {videos.filter((v) => v.ready).length} / {videos.length}
        </span>
      </div>
      <p className="mb-5 text-sm text-nb-mute">{t("prep.intro")}</p>

      {videos.length > 0 && (
        <fieldset className="mb-6 flex flex-wrap items-center gap-2">
          <legend className="sr-only">{t("prep.filter")}</legend>
          {chip("all", t("prep.filterAll"), videos.length)}
          {designs.map(([id, name]) =>
            chip(id, name, videos.filter((v) => v.design === id).length),
          )}
          {hasDemos && chip("demos", t("prep.filterDemos"), videos.filter((v) => v.demo).length)}
        </fieldset>
      )}

      {isLoading && <p className="py-6 text-sm text-nb-mute">{t("prep.loading")}</p>}
      {!isLoading && videos.length === 0 && (
        <p className="py-6 text-sm text-nb-mute">
          {categoryPath ? t("prep.emptyCategory") : t("prep.empty")}
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2">
        {visible.map((video) => (
          <ExplainerVideoCard key={video.videoId} video={video} />
        ))}
      </div>
    </section>
  );
}
