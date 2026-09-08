"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { getGallery } from "@/features/gallery/api/gallery";
import type { EngineName } from "@/infrastructure/api/types";
import { GalleryCard } from "./GalleryCard";
import "./GalleryGrid.css";

const ENGINES: EngineName[] = ["playwright", "remotion", "hyperframes"];

export function GalleryGrid() {
  const t = useTranslations("gallery");
  const [page, setPage] = useState(1);
  const [engine, setEngine] = useState<EngineName | undefined>();
  const { data, isPending, isError } = useQuery({
    queryKey: ["output-gallery", page, engine],
    queryFn: () => getGallery({ page, pageSize: 6, engine }),
  });

  const selectEngine = (next?: EngineName) => {
    setEngine(next);
    setPage(1);
  };

  return (
    <div className="nr-gallery-grid">
      <div className="nr-gallery-grid__header">
        <h2 className="nr-gallery-grid__title">{t("eyebrow")}</h2>
      </div>

      <fieldset className="nr-gallery-grid__filters" aria-label={t("filtersLabel")}>
        <button
          className="nr-gallery-grid__filter"
          data-active={!engine}
          onClick={() => selectEngine()}
          type="button"
        >
          {t("allEngines")}{" "}
          <span>{data?.categories.reduce((sum, category) => sum + category.count, 0) ?? 0}</span>
        </button>
        {ENGINES.map((value) => (
          <button
            className="nr-gallery-grid__filter"
            data-active={engine === value}
            key={value}
            onClick={() => selectEngine(value)}
            type="button"
          >
            {value}{" "}
            <span>
              {data?.categories.find((category) => category.engine === value)?.count ?? 0}
            </span>
          </button>
        ))}
      </fieldset>

      {isPending && <p className="nr-gallery-grid__empty">{t("loading")}</p>}
      {isError && <p className="nr-gallery-grid__empty">{t("errorState")}</p>}
      {data && data.items.length > 0 && (
        <div className="nr-gallery-grid__cards">
          {data.items.map((item) => (
            <GalleryCard key={item.id} item={item} />
          ))}
        </div>
      )}
      {data && data.items.length === 0 && (
        <p className="nr-gallery-grid__empty">{t("emptyState")}</p>
      )}

      {data && data.pagination.totalPages > 1 && (
        <nav className="nr-gallery-grid__pagination" aria-label={t("paginationLabel")}>
          <button
            type="button"
            disabled={!data.pagination.hasPreviousPage}
            onClick={() => setPage((value) => value - 1)}
          >
            {t("previous")}
          </button>
          <span>
            {t("page", { page: data.pagination.page, total: data.pagination.totalPages })}
          </span>
          <button
            type="button"
            disabled={!data.pagination.hasNextPage}
            onClick={() => setPage((value) => value + 1)}
          >
            {t("next")}
          </button>
        </nav>
      )}
    </div>
  );
}
