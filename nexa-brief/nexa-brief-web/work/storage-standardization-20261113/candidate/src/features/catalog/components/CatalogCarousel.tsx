"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { CatalogTile } from "@/features/home/components/catalog/CatalogTile";
import { assignShapes, type CatalogItem } from "@/features/home/components/catalog/catalog-items";
import { MarqueeRow } from "@/features/home/components/catalog/MarqueeRow";
import { Link } from "@/i18n/navigation";
import { playbackSource } from "../playback";
import type { PageSize } from "../types";
import { useCatalog } from "../useCatalog";
import { CatalogControls } from "./CatalogControls";

export function CatalogCarousel() {
  const t = useTranslations("templatesRow");
  const tc = useTranslations("catalog");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>("all");
  const query = useCatalog("public", { category, page, pageSize });
  const items: CatalogItem[] = (query.data?.items ?? []).map((item) => ({
    key: item.id,
    brand: query.data?.categories.find((c) => c.id === item.category_ids[0])?.name ?? "",
    title: item.title,
    kind: "DEMO",
    tags: ["DEMO"],
    poster: item.poster_url,
    fit: item.orientation === "9:16" ? "tall" : item.orientation === "16:9" ? "wide" : "both",
    shape: "wide",
    live: null,
    modal: playbackSource(item),
  }));
  const rows =
    items.length >= 8
      ? [items.filter((_, i) => i % 2 === 0), items.filter((_, i) => i % 2 === 1)]
      : [items];
  return (
    <section className="nexa-home-templates relative z-[5] pt-[70px] pb-8">
      <div className="mx-auto mb-6 max-w-[1280px] px-6 md:px-10">
        <h2 className="font-nb-sans text-[clamp(26px,3.4vw,42px)] leading-[1.05] font-extrabold tracking-[-0.03em]">
          {t("heading")}
        </h2>
        <p className="mt-2 max-w-[520px] text-sm text-nb-ink-soft">{tc("publicHint")}</p>
        <CatalogControls
          data={query.data}
          category={category}
          page={page}
          pageSize={pageSize}
          onCategory={(value) => {
            setCategory(value);
            setPage(1);
          }}
          onPage={setPage}
          onPageSize={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />
        <Link href="/plantillas" className="text-xs font-semibold">
          {t("seeAll")} ›
        </Link>
        {query.isLoading && <p role="status">{tc("loading")}</p>}
        {query.isError && <p role="alert">{tc("error")}</p>}
        {query.data?.items.length === 0 && <p>{tc("empty")}</p>}
      </div>
      <div className="flex flex-col gap-1">
        {rows
          .filter((row) => row.length > 0)
          .map((row, i) => (
            <MarqueeRow
              key={`${category}:${page}:${row[0].key}`}
              items={assignShapes(row)}
              height={270}
              speed={i === 0 ? 24 : 16}
              label={t("heading")}
              renderItem={(item, width) => <CatalogTile item={item} width={width} />}
            />
          ))}
      </div>
    </section>
  );
}
