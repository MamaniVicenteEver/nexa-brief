"use client";

import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { PageSize } from "../types";
import { useCatalog } from "../useCatalog";
import { CatalogCard } from "./CatalogCard";
import { CatalogControls } from "./CatalogControls";

const STATUS_TONE: Record<string, string> = {
  active: "bg-nb-green/70 text-nb-green-dark",
  planned: "bg-nb-accent-gold/40 text-[#7a5a10]",
  empty: "bg-nb-bg-2 text-nb-mute",
};

export function CatalogWindow() {
  const t = useTranslations("catalog");
  const report = useTranslations("templates.windows.catalogReport");
  const windows = useTranslations("templates.windows");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>("all");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const query = useCatalog("internal", { category, page, pageSize });
  const data = query.data;
  const categories = data?.categories ?? [];
  const visibleCategories = categories.filter((item) => category === "all" || item.id === category);
  const allOpen =
    visibleCategories.length > 0 &&
    visibleCategories.every((item) => openCategories[item.id] ?? true);
  const categoriesWithItems = categories.filter(
    (item) => (data?.category_counts[item.id] ?? 0) > 0,
  ).length;

  const statusLabel = (status: string) => {
    if (status === "active") return windows("status.active");
    if (status === "planned") return windows("status.planned");
    if (status === "empty") return windows("status.empty");
    return status;
  };

  const changeCategory = (value: string) => {
    setCategory(value);
    setPage(1);
  };

  const toggleAll = () => {
    setOpenCategories((current) => {
      const next = { ...current };
      for (const item of visibleCategories) next[item.id] = !allOpen;
      return next;
    });
  };

  return (
    <section>
      {data && (
        <section
          aria-labelledby="catalog-summary-title"
          className="mb-5 rounded-2xl border border-nb-line bg-nb-surface/80 p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="catalog-summary-title"
                className="font-nb-sans text-base font-extrabold text-nb-ink"
              >
                {report("title")}
              </h2>
              <p className="mt-1 text-xs text-nb-mute">{report("description")}</p>
            </div>
            <button
              type="button"
              onClick={toggleAll}
              disabled={visibleCategories.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-nb-line bg-white/70 px-3 py-1.5 text-xs font-semibold text-nb-ink-soft transition-colors hover:border-nb-ink hover:text-nb-ink disabled:opacity-50"
            >
              {allOpen ? (
                <ChevronsDownUp aria-hidden className="size-3.5" />
              ) : (
                <ChevronsUpDown aria-hidden className="size-3.5" />
              )}
              {report(allOpen ? "collapseAll" : "expandAll")}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <article className="rounded-xl border border-nb-line/80 bg-white/65 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-nb-mute">
                {report("categories")}
              </p>
              <p className="mt-1 text-xl font-extrabold leading-none text-nb-ink">
                {categories.length}
              </p>
            </article>
            <article className="rounded-xl border border-nb-line/80 bg-white/65 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-nb-mute">
                {report("categoriesWithItems")}
              </p>
              <p className="mt-1 text-xl font-extrabold leading-none text-nb-ink">
                {categoriesWithItems}
                <span className="ml-1 text-xs font-semibold text-nb-mute">
                  / {categories.length}
                </span>
              </p>
            </article>
            <article className="rounded-xl border border-nb-line/80 bg-white/65 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-nb-mute">
                {windows("status.active")}
              </p>
              <p className="mt-1 text-xl font-extrabold leading-none text-nb-ink">
                {categories.filter((item) => item.status === "active").length}
              </p>
            </article>
            <article className="rounded-xl border border-nb-line/80 bg-white/65 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-nb-mute">
                {report("demos")} ·{" "}
                {category === "all"
                  ? t("all")
                  : categories.find((item) => item.id === category)?.name}
              </p>
              <p className="mt-1 text-xl font-extrabold leading-none text-nb-ink">{data.total}</p>
            </article>
          </div>
          <div className="mt-4 border-t border-nb-line/80 pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-nb-mute">
              {report("categoryCoverage")}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {categories.map((item) => (
                <li
                  key={item.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-nb-line bg-white/70 py-1 pl-2.5 pr-1.5"
                >
                  <span className="max-w-40 truncate text-[10px] font-semibold text-nb-ink">
                    {item.name}
                  </span>
                  <span
                    className={`${STATUS_TONE[item.status] ?? STATUS_TONE.empty} rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase`}
                  >
                    {statusLabel(item.status)}
                  </span>
                  <span
                    aria-hidden
                    className="min-w-4 text-center text-[10px] font-bold tabular-nums text-nb-mute"
                  >
                    {data.category_counts[item.id] ?? 0}
                  </span>
                  <span className="sr-only">
                    {windows("designsCount", {
                      count: data.category_counts[item.id] ?? 0,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <CatalogControls
        data={data}
        category={category}
        page={page}
        pageSize={pageSize}
        onCategory={changeCategory}
        onPage={setPage}
        onPageSize={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />
      {query.isLoading && <p role="status">{t("loading")}</p>}
      {query.isError && <p role="alert">{t("error")}</p>}
      {data &&
        visibleCategories.map((item) => {
          const isOpen = openCategories[item.id] ?? true;
          const categoryItems = data.items.filter((entry) => entry.category_ids.includes(item.id));
          const total = data.category_counts[item.id] ?? 0;
          const contentId = `catalog-category-content-${item.id}`;
          return (
            <section key={item.id} aria-labelledby={`catalog-category-${item.id}`}>
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  aria-label={report(isOpen ? "collapseCategory" : "expandCategory", {
                    name: item.name,
                  })}
                  onClick={() =>
                    setOpenCategories((current) => ({
                      ...current,
                      [item.id]: !isOpen,
                    }))
                  }
                  className="my-5 flex w-full items-center gap-3 text-left"
                >
                  <span
                    id={`catalog-category-${item.id}`}
                    className="shrink-0 text-xs font-semibold text-nb-mute"
                  >
                    {item.name}
                  </span>
                  <span aria-hidden className="h-px min-w-0 flex-1 bg-nb-line" />
                  <span
                    className={`${STATUS_TONE[item.status] ?? STATUS_TONE.empty} shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase`}
                  >
                    {statusLabel(item.status)}
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-nb-mute">
                    {windows("designsCount", { count: total })}
                  </span>
                  <ChevronDown
                    aria-hidden
                    className={`size-3.5 shrink-0 text-nb-mute transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
                  />
                </button>
              </h3>
              <div id={contentId} hidden={!isOpen}>
                {isOpen &&
                  (categoryItems.length > 0 ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-2">
                      {categoryItems.map((entry) => (
                        <CatalogCard key={entry.id} item={entry} internal />
                      ))}
                    </div>
                  ) : (
                    <p className="pb-3 text-sm text-nb-mute">
                      {total === 0 ? report("emptyCategory") : t("results", { count: 0 })}
                    </p>
                  ))}
              </div>
            </section>
          );
        })}
    </section>
  );
}
