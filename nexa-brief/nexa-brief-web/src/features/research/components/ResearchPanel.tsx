"use client";

import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDebouncedValue } from "@/features/library/hooks/useLibraryAssets";
import { ResourcePagination } from "@/features/resources/components/ResourcePagination";
import { useResearchCategories, useResearchPage, useResearchSync } from "../hooks/useResearch";
import { ResearchCard } from "./ResearchCard";
import { ResearchDetailDialog } from "./ResearchDetailDialog";

const PAGE_SIZE = 12;

/** Pestaña Investigaciones: tarjetas de las investigaciones de los videos, buscables y reutilizables. */
export function ResearchPanel() {
  const t = useTranslations("resources.research");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useResearchPage({
    q: debouncedQuery,
    category,
    page,
    pageSize: PAGE_SIZE,
  });
  const categories = useResearchCategories();
  const sync = useResearchSync();

  useEffect(() => {
    if (data && page > Math.max(1, Math.ceil(data.total / PAGE_SIZE)))
      setPage(Math.max(1, Math.ceil(data.total / PAGE_SIZE)));
  }, [data, page]);

  function runSync() {
    sync.mutate(undefined, {
      onSuccess: (report) =>
        toast.success(t("syncDone", { created: report.created, merged: report.merged })),
      onError: () => toast.error(t("syncError")),
    });
  }

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-nb-mute" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
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
              className="absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-nb-mute hover:bg-nb-bg-2 hover:text-nb-ink"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
          aria-label={t("categoryLabel")}
          className="w-48 shrink-0 cursor-pointer rounded-xl border border-nb-line bg-nb-surface px-3.5 py-2.5 text-[13px] text-nb-ink outline-none focus:border-nb-green-dark focus:ring-3 focus:ring-nb-green/30"
        >
          <option value="">{t("allCategories")}</option>
          {categories.data?.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={runSync}
          disabled={sync.isPending}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-nb-line bg-nb-surface px-3.5 py-2.5 text-[13px] font-semibold text-nb-ink hover:bg-nb-bg-2 disabled:opacity-60"
        >
          {sync.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {sync.isPending ? t("syncing") : t("sync")}
        </button>
      </div>

      <p className="mt-2 text-[12.5px] text-nb-mute">{t("summary", { total: data?.total ?? 0 })}</p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading &&
          Array.from({ length: 8 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos
            <div key={index} className="h-64 animate-pulse rounded-2xl bg-nb-bg-2" />
          ))}
        {isError && (
          <div className="col-span-full py-8 text-center">
            <p className="text-sm text-nb-accent-coral">{t("error")}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-2 text-xs font-semibold underline"
            >
              {t("retry")}
            </button>
          </div>
        )}
        {!isLoading && !isError && data?.total === 0 && (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-nb-line px-6 py-10 text-center sm:col-span-1 lg:col-span-3">
            <p className="text-[14px] font-semibold text-nb-ink">
              {query || category ? t("emptyFiltered") : t("empty")}
            </p>
            <p className="mt-1 text-[12.5px] text-nb-mute">{t("emptyHint")}</p>
          </div>
        )}
        {!isLoading &&
          !isError &&
          data?.items.map((card) => (
            <ResearchCard key={card.id} card={card} onOpen={() => setSelectedId(card.id)} />
          ))}
      </div>

      {data && !isError && (
        <div className="mt-5">
          <ResourcePagination
            page={page}
            total={data.total}
            onChange={setPage}
            disabled={isFetching || query !== debouncedQuery}
          />
        </div>
      )}

      <ResearchDetailDialog
        researchId={selectedId}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onSelectVersion={setSelectedId}
      />
    </>
  );
}
