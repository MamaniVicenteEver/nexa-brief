"use client";

import { Images, Video } from "lucide-react";
import Link from "next/link";
import { useStandardShowcase } from "@/features/showcase/hooks/useStandardShowcase";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import type { CategoryNode } from "@/features/categories";
import { useImagePosts } from "@/features/image-posts/hooks/useImagePosts";
import { useSandbox } from "@/features/sandbox/hooks/useSandbox";
import {
  isPreparedVideo,
  isReviewDemo,
  isRenderedImage,
  isRenderedVideo,
} from "@/features/templates/lib/preparation-items";
import {
  type PreparationView,
  PreparationViewContext,
} from "@/features/templates/lib/preparation-view";
import { sandboxDesignDemos } from "@/features/templates/lib/sandbox-design-demos";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useExplainerVideos } from "../hooks/useExplainer";
import { CreateExplainerVideoModal } from "./CreateExplainerVideoModal";
import { DesignUsagePanel } from "./DesignUsagePanel";
import { ExplainerPrepSection } from "./ExplainerPrepSection";
import { ProductionsList } from "./ProductionsList";

const CONTENT_TAB_CLASS =
  "h-9 w-26 flex-none rounded-full border-nb-line bg-white/60 px-3 text-xs font-semibold sm:w-28 data-[state=active]:bg-nb-ink data-[state=active]:text-white";

/** Ventana de una categoría con motor explainer-kit en /plantillas. */
export function ExplainerCategoryWindow({
  category,
  posts,
  samples,
}: {
  category: CategoryNode;
  posts?: ReactNode;
  samples?: ReactNode;
}) {
  const t = useTranslations("explainer");
  const prep = useTranslations("templates.prep");
  const [createOpen, setCreateOpen] = useState(false);
  const [initialTopic, setInitialTopic] = useState("");
  const [contentType, setContentType] = useState("videos");
  const [view, setView] = useState<PreparationView>("preparation");
  const videos = useExplainerVideos(category.path);
  const showcase = useStandardShowcase("");
  const categoryDesigns = (showcase.designs.data?.designs ?? []).filter((design) =>
    design.state === "produccion" && [design.category_path, ...(design.shared_categories ?? [])].some((path) =>
      path === category.path || path?.startsWith(`${category.path}/`),
    ),
  );
  const images = useImagePosts(category.id);
  const selected = contentType === "videos" ? videos : images;
  const videoItems = videos.data ?? [];
  const imageItems = images.data ?? [];
  const sandbox = useSandbox();
  const sandboxDemos = sandboxDesignDemos(sandbox.data ?? [], category.id, videoItems, categoryDesigns);
  const counts =
    contentType === "videos"
      ? {
          preparation: videoItems.filter((video) => isPreparedVideo(video) || isReviewDemo(video)).length + sandboxDemos.length,
          rendered: videoItems.filter(isRenderedVideo).length,
        }
      : {
          preparation: imageItems.filter((post) => !isRenderedImage(post)).length,
          rendered: imageItems.filter(isRenderedImage).length,
        };
  // Cambiar la key reinicia el formulario del modal en cada apertura.
  const [modalKey, setModalKey] = useState(0);
  const openCreate = (topic = "") => {
    setInitialTopic(topic);
    setModalKey((k) => k + 1);
    setCreateOpen(true);
  };
  const newsIdeas = category.id === "node_actualidad" ? (category.strategy?.topicIdeas ?? []) : [];

  return (
    <div className="flex min-w-0 flex-col">
      {newsIdeas.length > 0 && (
        <section aria-labelledby="actualidad-ideas" className="mb-5 rounded-2xl border border-nb-line bg-nb-surface p-4">
          <div className="mb-3">
            <h2 id="actualidad-ideas" className="text-sm font-extrabold text-nb-ink">{t("window.newsIdeasTitle")}</h2>
            <p className="mt-1 text-xs text-nb-mute">{t("window.newsIdeasHint")}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {newsIdeas.map((idea) => (
              <button key={idea} type="button" onClick={() => openCreate(idea)} className="rounded-xl border border-nb-line bg-white/60 p-3 text-left text-[12px] font-medium leading-relaxed text-nb-ink transition-colors hover:border-nb-ink hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2">
                {idea}
              </button>
            ))}
          </div>
        </section>
      )}
      <section aria-labelledby={`preparation-${category.id}`}>
        <h2 id={`preparation-${category.id}`} className="sr-only">
          {prep("heading")}
        </h2>
        <Tabs value={contentType} onValueChange={setContentType} className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList
              aria-label={prep("contentTabsLabel")}
              className="h-9 gap-1 rounded-full bg-transparent p-0 group-data-horizontal/tabs:h-9"
            >
              <TabsTrigger value="videos" className={CONTENT_TAB_CLASS}>
                <Video aria-hidden />
                {prep("videosTab")}
              </TabsTrigger>
              {posts && (
                <TabsTrigger value="posts" className={CONTENT_TAB_CLASS}>
                  <Images aria-hidden />
                  {prep("postsTab")}
                </TabsTrigger>
              )}
            </TabsList>
            <fieldset
              aria-label={prep("viewTabsLabel")}
              className="inline-flex rounded-full border border-nb-line bg-white/50 p-1"
            >
              {(["preparation", "rendered"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={view === item}
                  onClick={() => setView(item)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    view === item ? "bg-nb-ink text-white" : "text-nb-ink-soft hover:text-nb-ink",
                  )}
                >
                  {item === "preparation" ? prep("heading") : prep("tabRendered")} (
                  {selected.isLoading
                    ? "…"
                    : selected.isError && !selected.data
                      ? "—"
                      : counts[item]}
                  )
                </button>
              ))}
            </fieldset>
            <button
              type="button"
              onClick={() => openCreate()}
              className="nb-btn-pill inline-flex h-9 w-26 items-center justify-center px-3 text-xs font-semibold sm:w-28"
            >
              {t("window.create")}
            </button>
          </div>
          {categoryDesigns.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs text-nb-mute">
            <span>Diseños:</span>
            {categoryDesigns.map((design) => <Link key={design.id} href={`/showcase?section=produccion&design=${encodeURIComponent(design.id)}`} className="rounded-full border border-nb-line px-3 py-1.5 text-nb-ink hover:border-nb-ink">{design.name}</Link>)}
          </div>}
          <PreparationViewContext.Provider value={view}>
            <TabsContent value="videos" forceMount hidden={contentType !== "videos"}>
              <ExplainerPrepSection
                categoryPath={category.path}
                sandboxDemos={sandboxDemos}
                productionDesignIds={categoryDesigns.map((design) => design.id)}
                embedded
              />
              <ProductionsList categoryPath={category.path} />
            </TabsContent>
            {posts && (
              <TabsContent value="posts" forceMount hidden={contentType !== "posts"}>
                {posts}
              </TabsContent>
            )}
          </PreparationViewContext.Provider>
        </Tabs>
      </section>
      <DesignUsagePanel key={category.path} categoryPath={category.path} />
      {samples}

      <CreateExplainerVideoModal
        key={modalKey}
        open={createOpen}
        onOpenChange={setCreateOpen}
        categoryPath={category.path}
        categoryName={category.displayName}
        initialTopic={initialTopic}
      />
    </div>
  );
}
