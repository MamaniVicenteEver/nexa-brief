"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { SandboxItem } from "@/features/sandbox/types";
import { isPreparedVideo, isRenderedVideo } from "@/features/templates/lib/preparation-items";
import {
  type PreparationView,
  usePreparationView,
} from "@/features/templates/lib/preparation-view";
import { cn } from "@/lib/utils";
import { useExplainerVideos } from "../hooks/useExplainer";
import { ExplainerVideoCard } from "./ExplainerVideoCard";
import { SandboxDesignDemoCard } from "./SandboxDesignDemoCard";

/** Videos completos listos para grabar y videos que ya tienen un render final. */
export function ExplainerPrepSection({
  categoryPath,
  sandboxDemos = [],
  embedded = false,
}: {
  categoryPath?: string;
  sandboxDemos?: SandboxItem[];
  embedded?: boolean;
} = {}) {
  const t = useTranslations("templates");
  const { data: videos = [], isLoading } = useExplainerVideos(categoryPath);
  const sharedView = usePreparationView();
  const [localView, setLocalView] = useState<PreparationView>("preparation");
  const view = sharedView ?? localView;
  const preparationVideos = videos.filter(isPreparedVideo);
  const renderedVideos = videos.filter(isRenderedVideo);
  const visible = [...(view === "preparation" ? preparationVideos : renderedVideos)].sort(
    (a, b) => Number(a.demo) - Number(b.demo) || a.title.localeCompare(b.title),
  );
  const productions = visible.filter((video) => !video.demo);
  const demos = visible.filter((video) => video.demo);
  const visibleSandboxDemos = view === "preparation" ? sandboxDemos : [];

  return (
    <section
      aria-label={embedded ? t("prep.videosTab") : undefined}
      aria-labelledby={embedded ? undefined : "explainer-prep-heading"}
      className={embedded ? "mb-6" : "mb-12"}
    >
      {!embedded && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2
            id="explainer-prep-heading"
            className="font-nb-sans text-[20px] font-extrabold tracking-[-0.02em] text-nb-ink"
          >
            {view === "preparation" ? t("prep.heading") : t("prep.renderedHeading")}
          </h2>
          <fieldset
            aria-label={t("prep.viewTabsLabel")}
            className="inline-flex rounded-full border border-nb-line bg-white/50 p-1"
          >
            {(["preparation", "rendered"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={view === item}
                onClick={() => setLocalView(item)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold",
                  view === item ? "bg-nb-ink text-white" : "text-nb-ink-soft",
                )}
              >
                {item === "preparation" ? t("prep.heading") : t("prep.tabRendered")} (
                {isLoading
                  ? "…"
                  : item === "preparation"
                    ? preparationVideos.length
                    : renderedVideos.length}
                )
              </button>
            ))}
          </fieldset>
        </div>
      )}
      {!embedded && (
        <p className="mb-4 text-sm text-nb-mute">
          {view === "preparation" ? t("prep.intro") : t("prep.renderedIntro")}
        </p>
      )}
      {isLoading && <p className="py-6 text-sm text-nb-mute">{t("prep.loading")}</p>}
      {!isLoading && visible.length === 0 && visibleSandboxDemos.length === 0 && (
        <p className="py-6 text-sm text-nb-mute">
          {view === "preparation" ? t("prep.emptyPreparation") : t("prep.emptyRendered")}
        </p>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-2">
        {productions.map((video) => (
          <ExplainerVideoCard key={video.videoId} video={video} />
        ))}
      </div>
      {(demos.length > 0 || visibleSandboxDemos.length > 0) && (
        <>
          <div className="my-5 flex items-center gap-3">
            <h3 className="shrink-0 text-xs font-semibold text-nb-mute">{t("prep.designDemos")}</h3>
            <hr className="w-full border-nb-line" />
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-2">
            {demos.map((video) => (
              <ExplainerVideoCard key={video.videoId} video={video} />
            ))}
            {visibleSandboxDemos.map((item) => (
              <SandboxDesignDemoCard key={`${item.folder}/${item.id}`} item={item} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
