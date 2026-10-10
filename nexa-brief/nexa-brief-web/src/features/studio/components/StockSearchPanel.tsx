"use client";

import { Check, Download, Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { RequirementMediaSlot } from "@/features/templates/types";
import { cn } from "@/lib/utils";
import { candidateRef } from "../api/studio-service";
import { useImportStock, useStockSearch } from "../hooks/useStock";
import type { MediaAssetKind, MediaRef, StockItem } from "../types";

/** Busca en los 3 proveedores a la vez y trae a la librería lo que se elija
 * (con su crédito). Busca solo al apretar Buscar: cada búsqueda gasta cupo
 * por hora de Pexels/Pixabay/Unsplash. */
export function StockSearchPanel({
  slot,
  kind,
  onImported,
}: {
  slot: RequirementMediaSlot;
  kind: MediaAssetKind;
  onImported: (ref: MediaRef) => void;
}) {
  const t = useTranslations("studio.stock");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const search = useStockSearch(query ? { q: query, kind, orientation: slot.orientation } : null);
  const importItem = useImportStock();
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<Record<string, string>>({});
  const [importError, setImportError] = useState<string | null>(null);

  async function onImport(item: StockItem) {
    const ref = candidateRef(item);
    const existing = item.library_asset_id ?? imported[ref];
    if (existing) {
      onImported({ assetId: existing, kind: item.kind });
      return;
    }
    setImporting(ref);
    setImportError(null);
    try {
      const result = await importItem.mutateAsync(item);
      setImported((prev) => ({ ...prev, [ref]: result.asset_id }));
      onImported({ assetId: result.asset_id, kind: result.kind });
    } catch {
      // 502 suele ser una URL temporal de Pixabay vencida: buscar de nuevo.
      setImportError(t("importError"));
    } finally {
      setImporting(null);
    }
  }

  const results = search.data?.results ?? [];
  const errors = search.data?.provider_errors ?? [];

  return (
    <div className="flex flex-col gap-2.5">
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draft.trim());
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-nb-mute" />
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("placeholder", { what: slot.hint || slot.label })}
            aria-label={t("placeholderShort")}
            className="w-full rounded-full border border-nb-line bg-nb-surface py-2 pr-3 pl-8.5 text-[13px] text-nb-ink outline-none placeholder:text-nb-mute focus:border-nb-green-dark focus:ring-3 focus:ring-nb-green/30"
          />
        </div>
        <button
          type="submit"
          disabled={!draft.trim()}
          className="nb-btn-pill px-3.5 py-2 text-[12px] font-semibold disabled:opacity-50"
        >
          {t("search")}
        </button>
      </form>

      {search.isFetching && (
        <p className="flex items-center gap-1.5 text-[12px] text-nb-mute">
          <Loader2 className="size-3.5 animate-spin" />
          {t("searching")}
        </p>
      )}
      {search.isError && <p className="text-[12px] text-nb-accent-coral">{t("searchError")}</p>}
      {errors.length > 0 && (
        <p className="text-[11px] text-nb-mute">
          {t("providerErrors", { providers: errors.map((e) => e.provider).join(", ") })}
        </p>
      )}
      {importError && <p className="text-[12px] text-nb-accent-coral">{importError}</p>}
      {query && !search.isFetching && search.isSuccess && results.length === 0 && (
        <p className="text-[12px] text-nb-mute">{t("noResults")}</p>
      )}

      {results.length > 0 && (
        <ul className="grid max-h-[340px] grid-cols-2 gap-2 overflow-y-auto pr-0.5">
          {results.map((item) => {
            const ref = candidateRef(item);
            const inLibrary = Boolean(item.library_asset_id ?? imported[ref]);
            return (
              <li key={ref}>
                <StockCard
                  item={item}
                  busy={importing === ref}
                  disabled={importing !== null}
                  inLibrary={inLibrary}
                  actionLabel={inLibrary ? t("use") : t("import")}
                  onAction={() => onImport(item)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Miniatura de un resultado de stock con crédito al autor. */
export function StockCard({
  item,
  busy = false,
  disabled = false,
  inLibrary = false,
  selected = false,
  actionLabel,
  onAction,
}: {
  item: StockItem;
  busy?: boolean;
  disabled?: boolean;
  inLibrary?: boolean;
  selected?: boolean;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-nb-surface",
        selected ? "border-nb-green-dark ring-2 ring-nb-green" : "border-nb-line",
      )}
    >
      <div className="relative aspect-video bg-nb-bg-2">
        {/* biome-ignore lint/performance/noImgElement: miniatura remota del proveedor de stock */}
        <img
          src={item.preview_url}
          alt={item.title}
          loading="lazy"
          className="size-full object-cover"
        />
        <span className="absolute top-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white capitalize">
          {item.provider}
        </span>
        <span className="absolute right-1 bottom-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white tabular-nums">
          {item.width}×{item.height}
          {item.duration_seconds ? ` · ${Math.round(item.duration_seconds)}s` : ""}
        </span>
      </div>
      <div className="flex items-center gap-1.5 p-1.5">
        <a
          href={item.author_url || item.source_url}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 truncate text-[10.5px] text-nb-mute hover:underline"
        >
          {item.author}
        </a>
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className="flex shrink-0 items-center gap-1 rounded-full bg-nb-ink px-2 py-1 text-[10.5px] font-semibold text-nb-surface disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-3 animate-spin" />
          ) : inLibrary || selected ? (
            <Check className="size-3" />
          ) : (
            <Download className="size-3" />
          )}
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
