"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useExplainerVideos } from "../hooks/useExplainer";
import { ACTIVE_JOB_STATES } from "../types";
import { ExplainerVideoCard } from "./ExplainerVideoCard";

type ExplainerView = "preparation" | "rendered";

/** Videos completos listos para grabar y videos que ya tienen un render final. */
export function ExplainerPrepSection({ categoryPath }: { categoryPath?: string } = {}) {
  const t = useTranslations("templates");
  const { data: videos = [], isLoading } = useExplainerVideos(categoryPath);
  const [view, setView] = useState<ExplainerView>("preparation");
  const [filter, setFilter] = useState<string>("all");

  const preparationVideos = videos.filter(
    (video) =>
      video.ready &&
      video.rendered.length === 0 &&
      !(video.lastJob && ACTIVE_JOB_STATES.includes(video.lastJob.state)),
  );
  const renderedVideos = videos.filter((video) => video.rendered.length > 0);
  const currentVideos = view === "preparation" ? preparationVideos : renderedVideos;
  const designs = Array.from(
    new Map<string, string>(
      currentVideos.map((video) => [video.design, video.designName || video.design] as const),
    ).entries(),
  );
  const hasDemos = currentVideos.some((video) => video.demo);
  const visible = currentVideos
    .filter((video) =>
      filter === "all" ? true : filter === "demos" ? video.demo : video.design === filter,
    )
    .sort((a, b) => Number(a.demo) - Number(b.demo) || a.title.localeCompare(b.title));

  const chip = (id: string, label: string, count: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      aria-pressed={filter === id}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
        filter === id
          ? "border-nb-ink bg-nb-ink text-[#fafaf7]"
          : "border-nb-line text-nb-ink-soft hover:border-nb-ink",
      )}
    >
      {label} · {count}
    </button>
  );

  const selectView = (next: ExplainerView) => {
    setView(next);
    setFilter("all");
  };

  return (
    <section aria-labelledby="explainer-prep-heading" className="mb-12">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2
          id="explainer-prep-heading"
          className="font-nb-sans text-[20px] font-extrabold tracking-[-0.02em] text-nb-ink"
        >
          {view === "preparation" ? t("prep.heading") : t("prep.renderedHeading")}
        </h2>
        <span className="text-xs text-nb-mute">{currentVideos.length}</span>
      </div>

      <div
        role="tablist"
        aria-label={t("prep.viewTabsLabel")}
        className="mb-4 flex flex-wrap gap-2"
      >
        {(["preparation", "rendered"] as const).map((tab) => {
          const selected = view === tab;
          const count = tab === "preparation" ? preparationVideos.length : renderedVideos.length;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="explainer-videos-panel"
              onClick={() => selectView(tab)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                selected
                  ? "border-nb-ink bg-nb-ink text-[#fafaf7]"
                  : "border-nb-line text-nb-ink-soft hover:border-nb-ink",
              )}
            >
              {tab === "preparation" ? t("prep.tabPreparation") : t("prep.tabRendered")} · {count}
            </button>
          );
        })}
      </div>

      <div id="explainer-videos-panel" role="tabpanel" tabIndex={0}>
        <p className="mb-5 text-sm text-nb-mute">
          {view === "preparation" ? t("prep.intro") : t("prep.renderedIntro")}
        </p>

        {currentVideos.length > 0 && (
          <fieldset className="mb-6 flex flex-wrap items-center gap-2">
            <legend className="sr-only">{t("prep.filter")}</legend>
            {chip("all", t("prep.filterAll"), currentVideos.length)}
            {designs.map(([id, name]) =>
              chip(id, name, currentVideos.filter((video) => video.design === id).length),
            )}
            {hasDemos &&
              chip(
                "demos",
                t("prep.filterDemos"),
                currentVideos.filter((video) => video.demo).length,
              )}
          </fieldset>
        )}

        {isLoading && <p className="py-6 text-sm text-nb-mute">{t("prep.loading")}</p>}
        {!isLoading && currentVideos.length === 0 && (
          <p className="py-6 text-sm text-nb-mute">
            {view === "preparation" ? t("prep.emptyPreparation") : t("prep.emptyRendered")}
          </p>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2">
          {visible.map((video) => (
            <ExplainerVideoCard key={video.videoId} video={video} />
          ))}
        </div>
      </div>
    </section>
  );
}
