"use client";

import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ExplainerVideoCard } from "@/features/explainer/components/ExplainerVideoCard";
import { SandboxDesignDemoCard } from "@/features/explainer/components/SandboxDesignDemoCard";
import { useTemplateCatalog } from "../hooks/useTemplateCatalog";
import { TemplateCard } from "./TemplateCard";

const STATUS_TONE = {
  active: "bg-nb-green/70 text-nb-green-dark",
  planned: "bg-nb-accent-gold/40 text-[#7a5a10]",
  empty: "bg-nb-bg-2 text-nb-mute",
} as const;

/** Catálogo agregado: cada categoría comparte tarjetas, conteos y estado desde un solo GET. */
export function AllDesignsWindow() {
  const t = useTranslations("templates");
  const { data: catalog, isLoading, isError } = useTemplateCatalog();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const sections = catalog?.categories ?? [];
  const summary = catalog?.summary;
  const allOpen =
    sections.length > 0 &&
    sections.every((section) => openCategories[section.category.id] ?? true);

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-nb-mute">{t("windows.loading")}</p>;
  }
  if (isError || !catalog || !summary) {
    return <p className="py-10 text-center text-sm text-nb-mute">{t("windows.loadError")}</p>;
  }

  const toggleAll = () => {
    const nextOpen = !allOpen;
    setOpenCategories(
      Object.fromEntries(sections.map((section) => [section.category.id, nextOpen])),
    );
  };

  return (
    <div className="flex min-w-0 flex-col">
      <section
        aria-labelledby="template-catalog-report-title"
        className="mb-5 rounded-2xl border border-nb-line bg-nb-surface/80 p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="template-catalog-report-title"
              className="font-nb-sans text-base font-extrabold tracking-[-0.02em] text-nb-ink"
            >
              {t("catalogReport.title")}
            </h2>
            <p className="mt-1 text-xs text-nb-mute">{t("catalogReport.description")}</p>
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-nb-line bg-white/70 px-3 py-1.5 text-xs font-semibold text-nb-ink-soft transition-colors hover:border-nb-ink hover:text-nb-ink"
          >
            {allOpen ? (
              <ChevronsDownUp aria-hidden className="size-3.5" />
            ) : (
              <ChevronsUpDown aria-hidden className="size-3.5" />
            )}
            {allOpen ? t("catalogReport.collapseAll") : t("catalogReport.expandAll")}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <article className="rounded-xl border border-nb-line/80 bg-white/65 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-nb-mute">
              {t("catalogReport.categories")}
            </p>
            <p className="mt-1 text-xl font-extrabold leading-none text-nb-ink">
              {summary.categoryCount}
            </p>
            <p className="mt-1 text-[10px] text-nb-mute">
              {t("catalogReport.categoryStatus", {
                active: summary.activeCategoryCount,
                planned: summary.plannedCategoryCount,
                empty: summary.emptyCategoryCount,
              })}
            </p>
          </article>
          <article className="rounded-xl border border-nb-line/80 bg-white/65 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-nb-mute">
              {t("catalogReport.categoriesWithItems")}
            </p>
            <p className="mt-1 text-xl font-extrabold leading-none text-nb-ink">
              {summary.categoriesWithItems}
              <span className="ml-1 text-xs font-semibold text-nb-mute">/ {summary.categoryCount}</span>
            </p>
            <p className="mt-1 text-[10px] text-nb-mute">{t("catalogReport.coverage")}</p>
          </article>
          <article className="rounded-xl border border-nb-line/80 bg-white/65 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-nb-mute">
              {t("catalogReport.pipelineTemplates")}
            </p>
            <p className="mt-1 text-xl font-extrabold leading-none text-nb-ink">
              {summary.pipelineTemplateCount}
            </p>
            <p className="mt-1 text-[10px] text-nb-mute">{t("catalogReport.production")}</p>
          </article>
          <article className="rounded-xl border border-nb-line/80 bg-white/65 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-nb-mute">
              {t("catalogReport.demos")}
            </p>
            <p className="mt-1 text-xl font-extrabold leading-none text-nb-ink">
              {summary.demoCount}
            </p>
            <p className="mt-1 text-[10px] text-nb-mute">
              {t("catalogReport.totalCards", { count: summary.totalCardCount })}
            </p>
          </article>
        </div>

        <div className="mt-4 border-t border-nb-line/80 pt-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-nb-mute">
            {t("catalogReport.categoryCoverage")}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {sections.map((section) => (
              <li
                key={section.category.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-nb-line bg-white/70 py-1 pl-2.5 pr-1.5"
              >
                <span className="max-w-40 truncate text-[10px] font-semibold text-nb-ink">
                  {section.category.displayName}
                </span>
                <span
                  className={STATUS_TONE[section.category.status] + " rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase"}
                >
                  {section.category.status === "active"
                    ? t("windows.status.active")
                    : section.category.status === "planned"
                      ? t("windows.status.planned")
                      : t("windows.status.empty")}
                </span>
                <span className="min-w-4 text-center text-[10px] font-bold tabular-nums text-nb-mute">
                  {section.totalItemCount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {sections.length === 0 && (
        <p className="py-10 text-center text-sm text-nb-mute">{t("windows.emptyDesigns")}</p>
      )}

      {sections.map((section) => {
        const category = section.category;
        const isOpen = openCategories[category.id] ?? true;
        return (
          <section key={category.id} aria-labelledby={"catalog-category-" + category.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={"catalog-category-content-" + category.id}
              aria-label={t(
                isOpen ? "catalogReport.collapseCategory" : "catalogReport.expandCategory",
                { name: category.displayName },
              )}
              onClick={() =>
                setOpenCategories((current) => ({
                  ...current,
                  [category.id]: !isOpen,
                }))
              }
              className="my-5 flex w-full items-center gap-3 text-left"
            >
              <span
                id={"catalog-category-" + category.id}
                role="heading"
                aria-level={2}
                className="shrink-0 text-xs font-semibold text-nb-mute"
              >
                {category.displayName}
              </span>
              <hr aria-hidden className="min-w-0 flex-1 border-nb-line" />
              <span
                className={STATUS_TONE[category.status] + " shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"}
              >
                {category.status === "active"
                  ? t("windows.status.active")
                  : category.status === "planned"
                    ? t("windows.status.planned")
                    : t("windows.status.empty")}
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-nb-mute">
                {section.totalItemCount}
              </span>
              <ChevronDown
                aria-hidden
                className={
                  "size-3.5 shrink-0 text-nb-mute transition-transform " +
                  (isOpen ? "rotate-0" : "-rotate-90")
                }
              />
            </button>

            <div
              id={"catalog-category-content-" + category.id}
              hidden={!isOpen}
              aria-hidden={!isOpen}
            >
              {isOpen &&
                (section.totalItemCount === 0 ? (
                  <p className="pb-3 text-sm text-nb-mute">{t("catalogReport.emptyCategory")}</p>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-2">
                    {section.templates.map((template) => (
                      <TemplateCard key={template.id} template={template} showDemoBadge />
                    ))}
                    {section.demoVideos.map((video) => (
                      <ExplainerVideoCard key={video.videoId} video={video} />
                    ))}
                    {section.sandboxDemos.map((demo) => (
                      <SandboxDesignDemoCard
                        key={demo.item.folder + "/" + demo.item.id}
                        item={demo.item}
                        productionDesign={demo.productionDesign}
                      />
                    ))}
                  </div>
                ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
