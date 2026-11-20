"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Music, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  getMusicGroupsPage,
  type LibraryAsset,
  resolveAssetPreviewUrl,
} from "@/features/library/api/library-assets-service";
import { libraryAssetsKey, useDebouncedValue } from "@/features/library/hooks/useLibraryAssets";
import { cn } from "@/lib/utils";
import { useLibraryCategories, useLibraryPage } from "../hooks/useResources";
import { type ResourceKind, toApiKind } from "../kinds";
import { useResourceScope } from "../ResourceScope";
import { AudioResourceOption } from "./AudioResourceOption";
import { ResourcePagination } from "./ResourcePagination";
import { UploadDropzone } from "./UploadDropzone";

interface CommonProps {
  kind: ResourceKind;
  /** Muestra una zona de subida: lo subido queda elegido. */
  allowUpload?: boolean;
  className?: string;
  /** Filtra canciones según si la plantilla exige letras o las admite opcionalmente. */
  musicLyricsMode?: "required" | "optional" | "none";
}

interface SingleProps extends CommonProps {
  multiple?: false;
  value: string | null;
  onChange: (assetId: string | null, asset: LibraryAsset | null) => void;
}

interface MultipleProps extends CommonProps {
  multiple: true;
  value: string[];
  onChange: (assetIds: string[]) => void;
}

export type ResourcePickerProps = SingleProps | MultipleProps;

function resourceCategoryLabel(category: string): string {
  if (category === "node_motion") return "NodeMotion";
  if (category === "node_actualidad") return "NodeNews";
  return category.replace(/_/g, " ");
}

/** Selector inline de recursos de la librería (para el Estudio): búsqueda,
 * selección y subida en el lugar. En modo simple, volver a tocar el elegido
 * lo deselecciona. */
export function ResourcePicker(props: ResourcePickerProps) {
  const { kind, allowUpload, className, musicLyricsMode = "none" } = props;
  const t = useTranslations("resources.picker");
  const tr = useTranslations("resources");
  const apiKind = toApiKind(kind);
  const isAudio = apiKind === "music" || apiKind === "sounds";
  const scope = useResourceScope();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [lyricsFilter, setLyricsFilter] = useState<"all" | "with" | "without">("all");
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebouncedValue(query);
  const scopedMusic =
    apiKind === "music" && scope.categoryId === "node_motion" && Boolean(scope.templateId);
  const musicCategory = scopedMusic ? (scope.categoryId ?? "") : category;
  const effectiveLyricsFilter =
    musicLyricsMode === "required" ? "with" : musicLyricsMode === "optional" ? lyricsFilter : "all";
  const hasLyrics =
    effectiveLyricsFilter === "with"
      ? true
      : effectiveLyricsFilter === "without"
        ? false
        : undefined;
  // Las canciones se agrupan antes de paginar; las demás clases conservan su página habitual.
  const ordinaryPage = useLibraryPage(apiKind, debouncedQuery, category, page, apiKind !== "music");
  const musicPage = useQuery({
    queryKey: [
      ...libraryAssetsKey("music"),
      "groups",
      { q: debouncedQuery, category: musicCategory, hasLyrics, page },
    ],
    queryFn: ({ signal }) =>
      getMusicGroupsPage(
        { q: debouncedQuery, category: musicCategory, hasLyrics, page, pageSize: 12 },
        signal,
      ),
    enabled: apiKind === "music" && (!scope.templateId || Boolean(scope.categoryId)),
  });
  const activePage = apiKind === "music" ? musicPage : ordinaryPage;
  const { data, isLoading, isError, isFetching, refetch } = activePage;
  const { data: categories } = useLibraryCategories(apiKind);
  const assets = apiKind === "music" ? undefined : ordinaryPage.data?.items;
  const musicGroups = apiKind === "music" ? musicPage.data?.items : undefined;
  useEffect(() => {
    if (data && page > Math.max(1, Math.ceil(data.total / 12)))
      setPage(Math.max(1, Math.ceil(data.total / 12)));
  }, [data, page]);
  const selected = props.multiple ? props.value : props.value ? [props.value] : [];

  function toggle(asset: LibraryAsset) {
    if (props.multiple) {
      const next = selected.includes(asset.assetId)
        ? selected.filter((id) => id !== asset.assetId)
        : [...selected, asset.assetId];
      props.onChange(next);
    } else if (props.value === asset.assetId) {
      props.onChange(null, null);
    } else {
      props.onChange(asset.assetId, asset);
    }
  }

  function pickUploaded(asset: LibraryAsset) {
    if (props.multiple) {
      if (!props.value.includes(asset.assetId)) props.onChange([...props.value, asset.assetId]);
    } else {
      props.onChange(asset.assetId, asset);
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-nb-mute" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder={t("search")}
          aria-label={t("search")}
          className="w-full rounded-full border border-nb-line bg-nb-surface py-2 pr-3 pl-8.5 text-[13px] text-nb-ink outline-none placeholder:text-nb-mute focus:border-nb-green-dark focus:ring-3 focus:ring-nb-green/30"
        />
      </div>
      {scopedMusic ? (
        <p className="rounded-xl border border-nb-line bg-nb-bg px-3 py-2 text-xs text-nb-ink-soft">
          {t("scopeCategory", { category: resourceCategoryLabel(scope.categoryId ?? "") })}
        </p>
      ) : (
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          aria-label={tr("categoryLabel")}
          className="min-w-0 rounded-xl border border-nb-line bg-nb-surface px-3 py-2 text-xs text-nb-ink"
        >
          <option value="">{tr("allCategories")}</option>
          {categories?.map((c) => (
            <option key={c} value={c}>
              {c === "sound_effects" ? tr("tabs.sounds") : c}
            </option>
          ))}
        </select>
      )}

      {apiKind === "music" && musicLyricsMode === "optional" && (
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-ink-soft">
          <span>{t("lyricsFilterLabel")}</span>
          <select
            value={lyricsFilter}
            onChange={(event) => {
              setLyricsFilter(event.target.value as "all" | "with" | "without");
              setPage(1);
            }}
            className="min-w-0 rounded-xl border border-nb-line bg-nb-surface px-3 py-2 text-xs text-nb-ink"
          >
            <option value="all">{t("lyricsFilterAll")}</option>
            <option value="with">{t("lyricsFilterReady")}</option>
            <option value="without">{t("lyricsFilterMissing")}</option>
          </select>
        </label>
      )}
      {apiKind === "music" && musicLyricsMode === "required" && (
        <p className="rounded-xl border border-nb-line bg-nb-bg px-3 py-2 text-xs text-nb-ink-soft">
          {t("lyricsFilterRequired")}
        </p>
      )}

      {isLoading && <p className="py-4 text-center text-[12.5px] text-nb-mute">{t("loading")}</p>}
      {isError && (
        <button
          type="button"
          onClick={() => void refetch()}
          className="py-3 text-xs text-nb-accent-coral"
        >
          {tr("loadError")} {tr("retry")}
        </button>
      )}
      {!isLoading && !isError && data?.total === 0 && (
        <p className="py-4 text-center text-[12.5px] text-nb-mute">
          {query || category || scopedMusic || hasLyrics !== undefined
            ? t("noResults")
            : t("empty")}
        </p>
      )}

      {musicGroups && musicGroups.length > 0 && (
        <ul className="grid grid-cols-1 gap-2">
          {musicGroups.map((group) => {
            const first = group.items[0];
            if (!first) return null;
            const groupSelected = group.items.some((asset) => selected.includes(asset.assetId));
            if (group.items.length === 1) {
              return (
                <li key={first.assetId}>
                  <AudioResourceOption
                    asset={first}
                    selected={groupSelected}
                    onClick={() => toggle(first)}
                  />
                </li>
              );
            }
            return (
              <li key={first.assetId}>
                <details
                  open={groupSelected || undefined}
                  className="group overflow-hidden rounded-xl border border-nb-line bg-nb-surface"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2.5 p-2.5 [&::-webkit-details-marker]:hidden">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-nb-bg-2">
                      <Music className="size-4 text-nb-mute" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[12.5px] font-semibold text-nb-ink">
                        {first.title}
                      </span>
                      <span className="text-[11px] text-nb-mute">
                        {t("versions", { count: group.items.length })}
                      </span>
                    </span>
                    {groupSelected && <Check className="size-4 shrink-0 text-nb-green-dark" />}
                    <ChevronDown className="size-4 shrink-0 text-nb-mute transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="flex flex-col gap-1.5 border-t border-nb-line p-2">
                    {group.items.map((asset, index) => (
                      <li key={asset.assetId}>
                        <AudioResourceOption
                          asset={asset}
                          label={t("version", { number: index + 1 })}
                          detail={[
                            asset.productionName || asset.templateName,
                            asset.addedAt?.slice(0, 10),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          selected={selected.includes(asset.assetId)}
                          onClick={() => toggle(asset)}
                        />
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      {assets && assets.length > 0 && (
        <ul
          className={cn(
            "grid gap-2 pr-0.5",
            isAudio ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4",
          )}
        >
          {assets.map((asset) => {
            const isSelected = selected.includes(asset.assetId);
            return (
              <li key={asset.assetId}>
                {isAudio ? (
                  <AudioResourceOption
                    asset={asset}
                    selected={isSelected}
                    onClick={() => toggle(asset)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(asset)}
                    aria-pressed={isSelected}
                    className={cn(
                      "relative w-full overflow-hidden rounded-xl border bg-nb-surface text-left transition-colors",
                      isSelected
                        ? "border-nb-green-dark ring-2 ring-nb-green"
                        : "border-nb-line hover:border-nb-green-dark",
                    )}
                  >
                    {/* biome-ignore lint/performance/noImgElement: vista previa del backend */}
                    <img
                      src={resolveAssetPreviewUrl(apiKind, asset.assetId)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="aspect-video w-full bg-nb-bg-2 object-cover"
                    />
                    <span className="block truncate px-2 py-1.5 text-[11.5px] font-medium text-nb-ink">
                      {asset.title}
                    </span>
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-nb-green-dark text-white">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {data && !isError && (
        <ResourcePagination
          page={page}
          total={data.total}
          onChange={setPage}
          disabled={isFetching || query !== debouncedQuery}
        />
      )}

      {allowUpload && (
        <UploadDropzone kind={apiKind} compact single={!props.multiple} onUploaded={pickUploaded} />
      )}
    </div>
  );
}
