"use client";

import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/features/library/hooks/useLibraryAssets";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { LibraryMedia, LibrarySort, LibraryTab } from "../domain/biblioteca";
import { useBiblioteca } from "../hooks/useBiblioteca";
import { BibliotecaPagination } from "./BibliotecaPagination";
import { ExplainerRecordingCard } from "./ExplainerRecordingCard";
import { ImageLibrary } from "./ImageLibrary";
import { VideoCard } from "./VideoCard";

const TABS: { id: LibraryTab; key: string }[] = [
  { id: "all", key: "todos" },
  { id: "pending", key: "pendientes" },
  { id: "published", key: "publicados" },
  { id: "processing", key: "proceso" },
  { id: "failed", key: "fallidos" },
];
const SORTS: LibrarySort[] = ["newest", "oldest", "longest", "title"];

export function BibliotecaView() {
  const t = useTranslations("library");
  const params = useSearchParams();
  const [media, setMedia] = useState<LibraryMedia>("videos");
  const [status, setStatus] = useState<LibraryTab>(
    TABS.find((tab) => tab.key === params.get("tab"))?.id ?? "all",
  );
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<LibrarySort>("newest");
  const [page, setPage] = useState(1);
  const library = useBiblioteca({ media, q, category, status, sort, page });
  const data = library.data;
  const busy = library.isFetching || query !== q;
  const filtersActive = Boolean(query.trim() || category);
  useEffect(() => {
    if (data && data.page !== page) setPage(data.page);
  }, [data, page]);
  function clearFilters() {
    setQuery("");
    setCategory("");
    setPage(1);
  }
  function selectMedia(next: LibraryMedia) {
    setMedia(next);
    setSort("newest");
    setStatus("all");
    setQuery("");
    setCategory("");
    setPage(1);
  }
  const categoryName = (id: string, label: string) =>
    id === "uncategorized" ? t("uncategorized") : label;
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-22 pb-16 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 sm:gap-6">
        <h1 className="shrink-0 font-nb-sans text-[clamp(22px,2.6vw,30px)] font-extrabold tracking-[-0.02em] text-nb-ink">
          {t("title")}
        </h1>
        <p className="min-w-0 max-w-[650px] text-right text-xs text-nb-mute sm:text-[13.5px]">
          {t("subtitle")}
        </p>
      </header>
      <div className="relative mt-5 flex flex-nowrap items-center gap-3 overflow-x-auto pb-2">
        <fieldset className="inline-flex shrink-0 gap-1.5">
          <legend className="sr-only">{t("mediaType.label")}</legend>
          {(["videos", "images"] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={media === type}
              onClick={() => selectMedia(type)}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                media === type
                  ? "border-nb-ink bg-nb-ink text-nb-surface"
                  : "border-nb-line bg-nb-surface text-nb-ink-soft hover:bg-nb-bg-2",
              )}
            >
              {t(`mediaType.${type}`)}
            </button>
          ))}
        </fieldset>
        <div className="relative ml-auto min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-nb-mute" />
          <input
            type="search"
            value={query}
            maxLength={200}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={t("filters.searchPlaceholder")}
            aria-label={t("filters.searchPlaceholder")}
            className="w-full rounded-xl border border-nb-line bg-nb-surface py-2.5 pr-10 pl-10 text-[13.5px] text-nb-ink outline-none placeholder:text-nb-mute focus:border-nb-green-dark focus:ring-3 focus:ring-nb-green/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setPage(1);
              }}
              aria-label={t("clearSearch")}
              className="absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-nb-mute hover:bg-nb-bg-2"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <label className="flex shrink-0 items-center gap-2 rounded-xl border border-nb-line bg-nb-surface px-3 py-2 text-nb-mute">
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          <span className="sr-only">{t("filters.sortLabel")}</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as LibrarySort);
              setPage(1);
            }}
            className="max-w-40 cursor-pointer bg-transparent text-[13px] text-nb-ink outline-none"
          >
            {SORTS.filter((value) => media === "videos" || value !== "longest").map((value) => (
              <option key={value} value={value}>
                {t(`filters.sort.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <Link
          href="/crear-video"
          className="nb-btn-pill inline-flex shrink-0 items-center gap-1.5 px-4.5 py-2.5 text-[13px] font-semibold whitespace-nowrap"
        >
          <Plus className="size-4" />
          {t("createVideo")}
        </Link>
      </div>
      <section className="mt-4 min-w-0" aria-busy={busy}>
        <fieldset
          className="flex min-w-0 items-center gap-2 overflow-x-auto pb-2"
          aria-label={t("filters.categoryLabel")}
        >
          <span className="mr-1 shrink-0 text-[11px] font-semibold tracking-[0.05em] text-nb-mute uppercase">
            {t("filters.categoryLabel")}
          </span>
          <CategoryChip
            label={t("filters.allCategories")}
            count={data?.categories.reduce((sum, c) => sum + c.count, 0) ?? 0}
            active={!category}
            onClick={() => {
              setCategory("");
              setPage(1);
            }}
          />
          {data?.categories.map((c) => (
            <CategoryChip
              key={c.id}
              label={categoryName(c.id, c.label)}
              count={c.count}
              active={category === c.id}
              onClick={() => {
                setCategory(category === c.id ? "" : c.id);
                setPage(1);
              }}
            />
          ))}
          {category && !data?.categories.some((c) => c.id === category) && (
            <button
              type="button"
              onClick={() => {
                setCategory("");
                setPage(1);
              }}
              className="shrink-0 text-xs underline"
            >
              {t("filters.clearFilters")}
            </button>
          )}
        </fieldset>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-nb-line">
          <fieldset
            className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto"
            aria-label={t("statusLabel")}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={status === tab.id}
                aria-label={`${t(`tabs.${tab.key}`)} ${data?.statusCounts[tab.id] ?? "–"}`}
                onClick={() => {
                  setStatus(tab.id);
                  setPage(1);
                }}
                className={cn(
                  "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13px] font-semibold transition-colors",
                  status === tab.id
                    ? "border-nb-ink text-nb-ink"
                    : "border-transparent text-nb-mute hover:text-nb-ink",
                )}
              >
                {t(`tabs.${tab.key}`)}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] tabular-nums",
                    status === tab.id ? "bg-nb-ink text-nb-surface" : "bg-nb-bg-2 text-nb-ink-soft",
                  )}
                >
                  {data?.statusCounts[tab.id] ?? "–"}
                </span>
              </button>
            ))}
          </fieldset>
          <div className="flex items-center gap-3 pb-3 text-xs text-nb-mute">
            {data && (
              <span>
                {media === "videos"
                  ? t("resultsCount", { count: data.total })
                  : t("images.count", { count: data.total })}
              </span>
            )}
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 font-semibold text-nb-ink-soft"
              >
                <X className="size-3.5" />
                {t("filters.clearFilters")}
              </button>
            )}
          </div>
        </div>
        <div className="mt-6">
          {library.isLoading ? (
            <CardGrid>
              {Array.from({ length: 8 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                <SkeletonCard key={`skeleton-${i}`} />
              ))}
            </CardGrid>
          ) : library.isError ? (
            <EmptyState
              message={t("loadError")}
              action={
                <button
                  type="button"
                  onClick={() => void library.refetch()}
                  className="nb-btn-secondary rounded-full px-4 py-2 text-sm"
                >
                  {t("retry")}
                </button>
              }
            />
          ) : !data?.items.length ? (
            <EmptyState
              message={t(
                filtersActive || status !== "all"
                  ? "emptyFiltered"
                  : media === "images"
                    ? "images.empty"
                    : "emptyLibrary",
              )}
              action={
                filtersActive && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="nb-btn-secondary rounded-full px-4 py-2 text-sm"
                  >
                    {t("filters.clearFilters")}
                  </button>
                )
              }
            />
          ) : media === "images" ? (
            <ImageLibrary items={data.items.filter((item) => item.kind === "image")} />
          ) : (
            <CardGrid>
              {data.items.map((item) =>
                item.kind === "video" ? (
                  <VideoCard key={item.id} video={item.video} />
                ) : item.kind === "recording" ? (
                  <ExplainerRecordingCard
                    key={item.id}
                    job={item.recording}
                    categoryLabel={categoryName(item.categoryId, item.categoryLabel)}
                  />
                ) : null,
              )}
            </CardGrid>
          )}
        </div>
        {data && !library.isError && data.total > 0 && (
          <BibliotecaPagination
            page={data.page}
            total={data.total}
            pageSize={data.pageSize}
            disabled={busy}
            onChange={setPage}
          />
        )}
      </section>
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${label} ${count}`}
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex max-w-[260px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
        active
          ? "border-nb-ink bg-nb-ink text-[#fafaf7]"
          : "border-nb-line bg-nb-surface text-nb-ink-soft hover:border-nb-ink/40 hover:text-nb-ink",
      )}
    >
      <span className="truncate">{label}</span>
      <span className={cn("tabular-nums", active ? "opacity-70" : "text-nb-mute")}>{count}</span>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[20px] bg-nb-surface">
      <div className="aspect-video w-full animate-pulse bg-nb-bg-2" />
      <div className="space-y-2.5 px-4.5 py-4">
        <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-nb-bg-2" />
        <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-nb-bg-2" />
        <div className="h-8 w-full animate-pulse rounded-full bg-nb-bg-2" />
      </div>
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-[20px] border border-dashed border-nb-line px-6 py-16 text-center">
      <Search className="size-6 text-nb-mute" />
      <p className="text-[13.5px] text-nb-mute">{message}</p>
      {action}
    </div>
  );
}
