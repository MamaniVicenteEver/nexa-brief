"use client";

import { useTranslations } from "next-intl";
import type { CatalogPage, PageSize } from "../types";

export function CatalogControls({
  data,
  category,
  page,
  pageSize,
  onCategory,
  onPage,
  onPageSize,
}: {
  data?: CatalogPage;
  category: string;
  page: number;
  pageSize: PageSize;
  onCategory: (value: string) => void;
  onPage: (value: number) => void;
  onPageSize: (value: PageSize) => void;
}) {
  const t = useTranslations("catalog");
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <div role="tablist" aria-label={t("categories")} className="flex flex-wrap gap-1">
        {[{ id: "all", name: t("all") }, ...(data?.categories ?? [])].map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={category === option.id}
            onClick={() => onCategory(option.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${category === option.id ? "bg-nb-ink text-nb-bg" : "text-nb-ink-soft hover:bg-nb-bg-2"}`}
          >
            {option.name}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-nb-ink-soft">
        {t("pageSize")}
        <select
          aria-label={t("pageSize")}
          value={pageSize}
          onChange={(event) =>
            onPageSize(event.target.value === "all" ? "all" : Number(event.target.value))
          }
          className="rounded-full border border-nb-line bg-nb-surface px-2 py-1"
        >
          {["all", 12, 24, 48].map((size) => (
            <option key={size} value={size}>
              {size === "all" ? t("all") : size}
            </option>
          ))}
        </select>
      </label>
      {data && <span className="text-xs text-nb-mute">{t("results", { count: data.total })}</span>}
      {data && data.total_pages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center gap-3 text-xs">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            {t("previous")}
          </button>
          <span>
            {page} / {data.total_pages}
          </span>
          <button
            type="button"
            disabled={page >= data.total_pages}
            onClick={() => onPage(page + 1)}
          >
            {t("next")}
          </button>
        </nav>
      )}
    </div>
  );
}
