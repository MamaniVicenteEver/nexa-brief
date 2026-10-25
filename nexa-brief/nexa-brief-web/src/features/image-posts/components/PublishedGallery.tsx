"use client";

import { AlertCircle, ArrowDownWideNarrow, Image, LoaderCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { CategoryNode } from "@/features/categories";
import { cn } from "@/lib/utils";
import { filterGalleryItems, getMetricValue } from "../gallery-utils";
import { useImageStrategies, usePublications } from "../hooks/useImagePosts";
import type {
  GalleryFilters,
  GalleryKind,
  MetricName,
  MetricsWindow,
  PublicationSummary,
} from "../types";
import { PublishedPostModal } from "./PublishedPostModal";

const DEFAULT_FILTERS = {
  categoryId: "",
  platform: "all" as const,
  kind: "all" as const,
  status: "all",
  strategyId: "all",
  metric: "reach" as const,
  window: "48h" as const,
  sort: "desc" as const,
};

function GalleryCard({
  item,
  metric,
  window,
  strategyName,
  onOpen,
  t,
}: {
  item: PublicationSummary;
  metric: MetricName;
  window: MetricsWindow;
  strategyName: string | null;
  onOpen: (item: PublicationSummary) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const metricDelivery = item.deliveries.find(
    (delivery) => getMetricValue(delivery, metric, window) !== null,
  );
  const metricValue = metricDelivery ? getMetricValue(metricDelivery, metric, window) : null;
  const when = item.latestPublishedAt ? new Date(item.latestPublishedAt) : new Date(item.createdAt);
  return (
    <article className="group overflow-hidden rounded-[20px] border border-nb-line bg-nb-surface shadow-[0_14px_30px_-20px_rgba(20,24,30,0.28)] transition-transform hover:-translate-y-0.5">
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-label={t("gallery.openPost", { title: item.title })}
        className="block w-full text-left"
      >
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#20252e]">
          {item.coverUrl ? (
            // biome-ignore lint/performance/noImgElement: gallery covers use short-lived signed URLs from the API.
            <img
              src={item.coverUrl}
              alt={item.slides[0]?.altTextInstagram || item.title}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center text-white/65">
              <Image className="size-6 text-[#e6b94f]" aria-hidden />
              <span className="max-w-[24ch] text-sm font-bold text-white">{item.title}</span>
              <span className="text-[10px]">
                {item.isDemo ? t("gallery.demoPreview") : t("gallery.previewUnavailable")}
              </span>
            </div>
          )}
          {item.isDemo && (
            <span className="absolute top-2 left-2 rounded-full bg-[#fff0c6] px-2.5 py-1 text-[9px] font-extrabold tracking-[0.1em] text-[#69501c] uppercase">
              {t("gallery.demoBadge")}
            </span>
          )}
          <span className="absolute right-2 bottom-2 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-bold text-white">
            {item.kind === "carousel"
              ? `${item.slides.length || 5} ${t("gallery.slides")}`
              : t(`gallery.kind.${item.kind}`)}
          </span>
        </div>
        <div className="flex flex-col gap-2.5 p-4">
          <div className="flex items-center justify-between gap-2 text-[10px] font-bold tracking-[0.1em] text-nb-mute uppercase">
            <span className="truncate">{item.categoryName}</span>
            <time dateTime={when.toISOString()}>
              {when.toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </time>
          </div>
          <h3 className="line-clamp-2 min-h-[2.6em] text-[15px] leading-[1.3] font-extrabold text-nb-ink">
            {item.title}
          </h3>
          {strategyName && (
            <p className="text-[11px] font-semibold text-nb-ink-soft">{strategyName}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {item.deliveries.map((delivery) => (
              <span
                key={delivery.deliveryId}
                className="rounded-full bg-nb-bg-2 px-2.5 py-1 text-[10px] font-semibold text-nb-ink-soft"
              >
                {delivery.platform === "facebook" ? "Facebook" : "Instagram"} ·{" "}
                {delivery.accountAlias}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-nb-line pt-2 text-[11px] text-nb-mute">
            <span>{t(`status.${item.status}`)}</span>
            <span>
              {metricValue === null
                ? t("gallery.metricUnavailable")
                : `${metricValue.toLocaleString()} ${t(`gallery.metrics.${metric}`)}`}
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}

export function PublishedGallery({
  categories,
  initialCategoryId,
}: {
  categories: CategoryNode[];
  initialCategoryId: string;
}) {
  const t = useTranslations("imagePosts");
  const [filters, setFilters] = useState<GalleryFilters>({
    ...DEFAULT_FILTERS,
    categoryId: initialCategoryId,
  });
  const [selected, setSelected] = useState<PublicationSummary | null>(null);
  const strategies = useImageStrategies();
  const query = usePublications(filters);
  const pages = query.data?.pages ?? [];
  const rawItems = pages.flatMap((page) => page.items);
  const items = useMemo(() => filterGalleryItems(rawItems, filters), [filters, rawItems]);
  const asOf = pages.at(-1)?.asOf;
  const update = <K extends keyof GalleryFilters>(key: K, value: GalleryFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-nb-line bg-white/80 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.16em] text-nb-mute uppercase">
              {t("gallery.eyebrow")}
            </p>
            <h3 className="mt-1 text-lg font-extrabold text-nb-ink">{t("gallery.title")}</h3>
            <p className="mt-1 text-xs text-nb-ink-soft">{t("gallery.description")}</p>
          </div>
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            className="nb-btn-secondary inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold disabled:opacity-60"
          >
            <RefreshCw className={cn("size-3.5", query.isFetching && "animate-spin")} aria-hidden />
            {t("gallery.refresh")}
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <label className="flex flex-col gap-1 text-[10px] font-bold text-nb-mute">
            {t("gallery.filters.category")}
            <select
              value={filters.categoryId}
              onChange={(event) => update("categoryId", event.target.value)}
              className="min-h-9 rounded-lg border border-nb-line bg-white px-2.5 text-xs text-nb-ink"
            >
              <option value="">{t("gallery.filters.allCategories")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold text-nb-mute">
            {t("gallery.filters.network")}
            <select
              value={filters.platform}
              onChange={(event) =>
                update("platform", event.target.value as GalleryFilters["platform"])
              }
              className="min-h-9 rounded-lg border border-nb-line bg-white px-2.5 text-xs text-nb-ink"
            >
              <option value="all">{t("gallery.filters.allNetworks")}</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold text-nb-mute">
            {t("gallery.filters.format")}
            <select
              value={filters.kind}
              onChange={(event) => update("kind", event.target.value as GalleryKind | "all")}
              className="min-h-9 rounded-lg border border-nb-line bg-white px-2.5 text-xs text-nb-ink"
            >
              <option value="all">{t("gallery.filters.allFormats")}</option>
              <option value="image">{t("gallery.kind.image")}</option>
              <option value="carousel">{t("gallery.kind.carousel")}</option>
              <option value="story">Story</option>
              <option value="reel">Reel</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold text-nb-mute">
            {t("gallery.filters.strategy")}
            <select
              value={filters.strategyId}
              onChange={(event) => update("strategyId", event.target.value)}
              className="min-h-9 rounded-lg border border-nb-line bg-white px-2.5 text-xs text-nb-ink"
            >
              <option value="all">{t("gallery.filters.allStrategies")}</option>
              {(strategies.data ?? []).map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold text-nb-mute">
            {t("gallery.filters.status")}
            <select
              value={filters.status}
              onChange={(event) => update("status", event.target.value)}
              className="min-h-9 rounded-lg border border-nb-line bg-white px-2.5 text-xs text-nb-ink"
            >
              <option value="all">{t("gallery.filters.publishedOnly")}</option>
              <option value="removed_api">{t("gallery.status.removed_api")}</option>
              <option value="removed_manually">{t("gallery.status.removed_manually")}</option>
              <option value="removed">{t("gallery.status.removed")}</option>
              <option value="removal_pending_manual">
                {t("gallery.status.removal_pending_manual")}
              </option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold text-nb-mute">
            {t("gallery.filters.metric")}
            <select
              value={filters.metric}
              onChange={(event) => update("metric", event.target.value as MetricName)}
              className="min-h-9 rounded-lg border border-nb-line bg-white px-2.5 text-xs text-nb-ink"
            >
              {(
                ["reach", "impressions", "likes", "comments", "shares", "saves", "plays"] as const
              ).map((metric) => (
                <option key={metric} value={metric}>
                  {t(`gallery.metrics.${metric}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[10px] font-bold text-nb-mute">
              {t("gallery.filters.window")}
              <select
                value={filters.window}
                onChange={(event) => update("window", event.target.value as MetricsWindow)}
                className="min-h-9 rounded-lg border border-nb-line bg-white px-2.5 text-xs text-nb-ink"
              >
                <option value="48h">48 h</option>
                <option value="7d">7 días</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-bold text-nb-mute">
              {t("gallery.filters.order")}
              <select
                value={filters.sort}
                onChange={(event) => update("sort", event.target.value as GalleryFilters["sort"])}
                className="min-h-9 rounded-lg border border-nb-line bg-white px-2.5 text-xs text-nb-ink"
              >
                <option value="desc">{t("gallery.filters.newest")}</option>
                <option value="asc">{t("gallery.filters.oldest")}</option>
              </select>
            </label>
          </div>
        </div>
        {asOf && (
          <p className="inline-flex items-center gap-1 text-[10px] text-nb-mute">
            <ArrowDownWideNarrow className="size-3" aria-hidden />
            {t("gallery.asOf", { date: new Date(asOf).toLocaleString() })}
          </p>
        )}
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <LoaderCircle
            className="size-6 animate-spin text-nb-mute"
            aria-label={t("gallery.loading")}
          />
        </div>
      ) : query.isError ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-800"
        >
          <AlertCircle className="size-5" />
          {t("gallery.error")}
          <button type="button" onClick={() => void query.refetch()} className="underline">
            {t("gallery.retry")}
          </button>
        </div>
      ) : items.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <GalleryCard
                key={item.publicationId}
                item={item}
                metric={filters.metric}
                window={filters.window}
                strategyName={
                  strategies.data?.find((strategy) => strategy.id === item.strategyId)?.name ??
                  item.strategyId
                }
                onOpen={setSelected}
                t={t}
              />
            ))}
          </div>
          {query.hasNextPage && (
            <button
              type="button"
              onClick={() => void query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className="nb-btn-secondary mx-auto rounded-full px-5 py-2.5 text-xs font-bold disabled:opacity-55"
            >
              {query.isFetchingNextPage ? t("gallery.loading") : t("gallery.loadMore")}
            </button>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-nb-line bg-white/60 p-10 text-center">
          <Image className="mx-auto size-7 text-nb-mute/50" aria-hidden />
          <p className="mt-3 text-sm font-bold text-nb-ink">{t("gallery.emptyTitle")}</p>
          <p className="mt-1 text-xs text-nb-mute">{t("gallery.emptyDescription")}</p>
        </div>
      )}

      <PublishedPostModal
        summary={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
