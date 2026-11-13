"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { LibraryAsset, LibraryAssetKind } from "@/features/library/api/library-assets-service";
import { useDebouncedValue } from "@/features/library/hooks/useLibraryAssets";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { useLibraryCategories, useLibraryPage } from "../hooks/useResources";
import { ResourceScopeProvider } from "../ResourceScope";
import { AssetCard } from "./AssetCard";
import { DeleteAssetDialog, EditAssetDialog } from "./AssetDialogs";
import { LyricsViewer } from "./LyricsViewer";
import { ResourcePagination } from "./ResourcePagination";
import { UploadDropzone } from "./UploadDropzone";

const TABS: LibraryAssetKind[] = ["music", "images", "videos", "sounds"];

/** Pantalla Recursos: la librería de canciones, imágenes y videos propios
 * que después se usan en las plantillas (por asset_id). */
export function ResourcesView() {
  const t = useTranslations("resources");
  const [kind, setKind] = useState<LibraryAssetKind>("music");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebouncedValue(query);
  const [editing, setEditing] = useState<LibraryAsset | null>(null);
  const [deleting, setDeleting] = useState<LibraryAsset | null>(null);
  const [lyricsOf, setLyricsOf] = useState<LibraryAsset | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useLibraryPage(
    kind,
    debouncedQuery,
    category,
    page,
  );
  const assets = data?.items;
  const {
    data: categories,
    isError: categoriesError,
    refetch: retryCategories,
  } = useLibraryCategories(kind);

  useEffect(() => {
    if (data && page > Math.max(1, Math.ceil(data.total / 12)))
      setPage(Math.max(1, Math.ceil(data.total / 12)));
  }, [data, page]);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const requested = search.get("kind");
    setCategory(search.get("category") ?? "");
    if (requested && TABS.includes(requested as LibraryAssetKind))
      setKind(requested as LibraryAssetKind);
  }, []);

  function selectKind(next: LibraryAssetKind) {
    const url = new URL(window.location.href);
    url.searchParams.set("kind", next);
    url.searchParams.delete("category");
    window.history.replaceState(null, "", url);
    setKind(next);
    setCategory("");
    setQuery("");
    setPage(1);
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pt-22 pb-16 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 sm:gap-6">
        <h1 className="shrink-0 font-nb-sans text-[clamp(22px,2.6vw,30px)] font-extrabold tracking-[-0.02em] text-nb-ink">
          {t("title")}
        </h1>
        <p className="min-w-0 max-w-[560px] text-right text-xs text-nb-mute sm:text-[13.5px]">
          {t("subtitle")}
        </p>
      </header>

      <section className="mt-5 min-w-0" aria-busy={isFetching}>
        <div className="flex flex-nowrap items-center gap-3 overflow-x-auto pb-2">
          <fieldset className="flex shrink-0 gap-1.5">
            <legend className="sr-only">{t("typeLabel")}</legend>
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={kind === tab}
                onClick={() => selectKind(tab)}
                className={cn(
                  "whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors",
                  kind === tab
                    ? "bg-nb-ink text-nb-surface"
                    : "border border-nb-line bg-nb-surface text-nb-ink-soft hover:bg-nb-bg-2",
                )}
              >
                {t(`tabs.${tab}`)}
              </button>
            ))}
          </fieldset>

          <div className="relative ml-auto min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-nb-mute" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t(`searchPlaceholder.${kind}`)}
              aria-label={t(`searchPlaceholder.${kind}`)}
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
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            aria-label={t("categoryLabel")}
            className="w-48 shrink-0 cursor-pointer rounded-xl border border-nb-line bg-nb-surface px-3.5 py-2.5 text-[13px] text-nb-ink outline-none focus:border-nb-green-dark focus:ring-3 focus:ring-nb-green/30"
          >
            <option value="">{t("allCategories")}</option>
            {categories?.map((c) => (
              <option key={c} value={c}>
                {c === "sound_effects" ? t("tabs.sounds") : c}
              </option>
            ))}
          </select>
        </div>

        {categoriesError && (
          <button
            type="button"
            onClick={() => void retryCategories()}
            className="mt-2 text-xs text-nb-accent-coral"
          >
            {t("retryCategories")}
          </button>
        )}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ResourceScopeProvider scope={{ categoryId: category || undefined }}>
            <UploadDropzone key={kind} kind={kind} card />
          </ResourceScopeProvider>
          {isLoading &&
            Array.from({ length: 11 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-nb-bg-2" />
            ))}
          {isError && (
            <div className="col-span-full py-8 text-center">
              <p className="text-sm text-nb-accent-coral">{t("loadError")}</p>
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
                {query || category ? t("emptyFiltered") : t(`empty.${kind}`)}
              </p>
              <p className="mt-1 text-[12.5px] text-nb-mute">{t("emptyHint")}</p>
            </div>
          )}
          {!isLoading &&
            !isError &&
            assets?.map((asset) => (
              <AssetCard
                key={asset.assetId}
                asset={asset}
                onEdit={() => setEditing(asset)}
                onDelete={() => setDeleting(asset)}
                onShowLyrics={() => setLyricsOf(asset)}
              />
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
      </section>

      <EditAssetDialog asset={editing} onOpenChange={(open) => !open && setEditing(null)} />
      <DeleteAssetDialog asset={deleting} onOpenChange={(open) => !open && setDeleting(null)} />
      <Dialog open={lyricsOf !== null} onOpenChange={(open) => !open && setLyricsOf(null)}>
        <DialogContent className="gap-4 rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="truncate">{lyricsOf?.title}</DialogTitle>
          </DialogHeader>
          {lyricsOf && <LyricsViewer assetId={lyricsOf.assetId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
