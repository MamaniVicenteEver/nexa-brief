"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { LibraryAsset, LibraryAssetKind } from "@/features/library/api/library-assets-service";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { useLibraryCategories, useLibraryList } from "../hooks/useResources";
import { AssetCard } from "./AssetCard";
import { DeleteAssetDialog, EditAssetDialog } from "./AssetDialogs";
import { LyricsViewer } from "./LyricsViewer";
import { UploadDropzone } from "./UploadDropzone";

const TABS: LibraryAssetKind[] = ["music", "images", "videos"];

/** Pantalla Recursos: la librería de canciones, imágenes y videos propios
 * que después se usan en las plantillas (por asset_id). */
export function ResourcesView() {
  const t = useTranslations("resources");
  const [kind, setKind] = useState<LibraryAssetKind>("music");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<LibraryAsset | null>(null);
  const [deleting, setDeleting] = useState<LibraryAsset | null>(null);
  const [lyricsOf, setLyricsOf] = useState<LibraryAsset | null>(null);
  const { data: assets, isLoading, isError } = useLibraryList(kind, query, category);
  const { data: categories } = useLibraryCategories(kind);

  function selectKind(next: LibraryAssetKind) {
    setKind(next);
    setCategory("");
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-22 pb-25 sm:px-10">
      <header>
        <h1 className="font-nb-sans text-[clamp(22px,2.6vw,30px)] font-extrabold tracking-[-0.02em] text-nb-ink">
          {t("title")}
        </h1>
        <p className="mt-1 max-w-[560px] text-[13.5px] text-nb-mute">{t("subtitle")}</p>
      </header>

      <div role="tablist" className="mt-7 flex gap-1 overflow-x-auto border-b border-nb-line">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={kind === tab}
            onClick={() => selectKind(tab)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-[13.5px] font-semibold transition-colors",
              kind === tab
                ? "border-nb-ink text-nb-ink"
                : "border-transparent text-nb-mute hover:text-nb-ink",
            )}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <UploadDropzone key={kind} kind={kind} />
        </aside>

        <section className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-nb-mute" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(`searchPlaceholder.${kind}`)}
                aria-label={t(`searchPlaceholder.${kind}`)}
                className="w-full rounded-full border border-nb-line bg-nb-surface py-2.5 pr-10 pl-10 text-[13.5px] text-nb-ink outline-none placeholder:text-nb-mute focus:border-nb-green-dark focus:ring-3 focus:ring-nb-green/30"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("clearSearch")}
                  className="absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-nb-mute hover:bg-nb-bg-2 hover:text-nb-ink"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label={t("categoryLabel")}
              className="cursor-pointer rounded-full border border-nb-line bg-nb-surface px-3.5 py-2.5 text-[13px] text-nb-ink outline-none"
            >
              <option value="">{t("allCategories")}</option>
              {categories?.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {isLoading && (
            <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
              {Array.from({ length: 6 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholders estáticos
                <div key={i} className="h-56 animate-pulse rounded-nb-xs bg-nb-bg-2" />
              ))}
            </div>
          )}
          {isError && (
            <p className="mt-10 text-center text-sm text-nb-accent-coral">{t("loadError")}</p>
          )}
          {!isLoading && !isError && assets?.length === 0 && (
            <div className="mt-5 rounded-nb-xs border border-dashed border-nb-line px-6 py-14 text-center">
              <p className="text-[14px] font-semibold text-nb-ink">
                {query || category ? t("emptyFiltered") : t(`empty.${kind}`)}
              </p>
              <p className="mt-1 text-[12.5px] text-nb-mute">{t("emptyHint")}</p>
            </div>
          )}
          {assets && assets.length > 0 && (
            <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.assetId}
                  asset={asset}
                  onEdit={() => setEditing(asset)}
                  onDelete={() => setDeleting(asset)}
                  onShowLyrics={() => setLyricsOf(asset)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

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
