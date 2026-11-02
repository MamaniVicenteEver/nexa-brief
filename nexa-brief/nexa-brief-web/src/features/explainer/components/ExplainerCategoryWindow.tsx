"use client";

import { Images, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import type { CategoryNode } from "@/features/categories";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { useCategoryDesigns } from "../hooks/useExplainer";
import { CreateExplainerVideoModal } from "./CreateExplainerVideoModal";
import { ExplainerPrepSection } from "./ExplainerPrepSection";
import { ProductionsList } from "./ProductionsList";

const HEADING_CLASS = "font-nb-sans text-[20px] font-extrabold tracking-[-0.02em] text-nb-ink";

/** Ventana de una categoría con motor explainer-kit en /plantillas. */
export function ExplainerCategoryWindow({
  category,
  posts,
}: {
  category: CategoryNode;
  posts?: ReactNode;
}) {
  const t = useTranslations("explainer");
  const prep = useTranslations("templates.prep");
  const { data: designsData } = useCategoryDesigns(category.path);
  const [createOpen, setCreateOpen] = useState(false);
  const [contentType, setContentType] = useState("videos");
  const [prefill, setPrefill] = useState("");
  // Cambiar la key reinicia el formulario del modal en cada apertura.
  const [modalKey, setModalKey] = useState(0);
  const strategy = category.strategy;

  const openCreate = (topic = "") => {
    setPrefill(topic);
    setModalKey((k) => k + 1);
    setCreateOpen(true);
  };

  return (
    <div className="flex flex-col">
      <header className="mb-10 flex flex-col gap-4 rounded-3xl border border-nb-line bg-nb-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[760px]">
            <h2 className={HEADING_CLASS}>{category.displayName}</h2>
            {strategy && (strategy.audience || strategy.angle) ? (
              <p className="mt-1 text-[13.5px] text-nb-ink-soft">
                {[strategy.audience, strategy.angle].filter(Boolean).join(" — ")}
              </p>
            ) : (
              <p className="mt-1 text-[13.5px] text-nb-mute">{category.topic}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => openCreate()}
            className="nb-btn-pill px-5 py-2.5 text-[13px] font-semibold"
          >
            {t("window.create")}
          </button>
        </div>
        {designsData?.shared && (
          <p className="text-[12.5px] text-nb-mute">{t("designs.sharedNote")}</p>
        )}
        {category.status !== "active" && (
          <p className="rounded-xl border border-dashed border-nb-line px-3 py-2 text-[12.5px] text-nb-mute">
            {t(`window.statusNote.${category.status}`)}
          </p>
        )}
        {strategy && strategy.topicIdeas.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold tracking-[0.08em] text-nb-mute uppercase">
              {t("window.topicIdeas")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {strategy.topicIdeas.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => openCreate(idea)}
                  className="rounded-full border border-nb-line px-3 py-1 text-[12px] font-semibold text-nb-ink-soft transition-colors hover:border-nb-ink hover:text-nb-ink"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <section aria-labelledby={`preparation-${category.id}`}>
        <h2 id={`preparation-${category.id}`} className={HEADING_CLASS}>
          {prep("heading")}
        </h2>
        <Tabs value={contentType} onValueChange={setContentType} className="mt-3 gap-5">
          <TabsList
            aria-label={prep("contentTabsLabel")}
            className="h-auto rounded-full border border-nb-line bg-white/60 p-1"
          >
            <TabsTrigger
              value="videos"
              className="rounded-full px-5 py-2 font-bold data-[state=active]:bg-nb-ink data-[state=active]:text-white"
            >
              <Video aria-hidden />
              {prep("videosTab")}
            </TabsTrigger>
            {posts && (
              <TabsTrigger
                value="posts"
                className="rounded-full px-5 py-2 font-bold data-[state=active]:bg-nb-ink data-[state=active]:text-white"
              >
                <Images aria-hidden />
                {prep("postsTab")}
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="videos" forceMount hidden={contentType !== "videos"}>
            <ExplainerPrepSection categoryPath={category.path} embedded />
            <ProductionsList categoryPath={category.path} />
          </TabsContent>
          {posts && (
            <TabsContent value="posts" forceMount hidden={contentType !== "posts"}>
              {posts}
            </TabsContent>
          )}
        </Tabs>
      </section>

      <CreateExplainerVideoModal
        key={modalKey}
        open={createOpen}
        onOpenChange={setCreateOpen}
        categoryPath={category.path}
        categoryName={category.displayName}
        initialTopic={prefill}
      />
    </div>
  );
}
