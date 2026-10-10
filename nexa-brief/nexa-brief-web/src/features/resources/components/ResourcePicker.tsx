"use client";

import { Check, Music, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { LibraryAsset } from "@/features/library/api/library-assets-service";
import { cn } from "@/lib/utils";
import { useLibraryList } from "../hooks/useResources";
import { formatDuration, type ResourceKind, toApiKind } from "../kinds";
import { TranscriptionBadge } from "./TranscriptionBadge";
import { UploadDropzone } from "./UploadDropzone";

interface CommonProps {
  kind: ResourceKind;
  /** Muestra una zona de subida: lo subido queda elegido. */
  allowUpload?: boolean;
  className?: string;
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

/** Selector inline de recursos de la librería (para el Estudio): búsqueda,
 * selección y subida en el lugar. En modo simple, volver a tocar el elegido
 * lo deselecciona. */
export function ResourcePicker(props: ResourcePickerProps) {
  const { kind, allowUpload, className } = props;
  const t = useTranslations("resources.picker");
  const apiKind = toApiKind(kind);
  const [query, setQuery] = useState("");
  const { data: assets, isLoading } = useLibraryList(apiKind, query);
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
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          className="w-full rounded-full border border-nb-line bg-nb-surface py-2 pr-3 pl-8.5 text-[13px] text-nb-ink outline-none placeholder:text-nb-mute focus:border-nb-green-dark focus:ring-3 focus:ring-nb-green/30"
        />
      </div>

      {isLoading && <p className="py-4 text-center text-[12.5px] text-nb-mute">{t("loading")}</p>}
      {!isLoading && assets?.length === 0 && (
        <p className="py-4 text-center text-[12.5px] text-nb-mute">
          {query ? t("noResults") : t("empty")}
        </p>
      )}

      {assets && assets.length > 0 && (
        <ul
          className={cn(
            "grid max-h-[340px] gap-2 overflow-y-auto pr-0.5",
            apiKind === "music" ? "grid-cols-1" : "grid-cols-[repeat(auto-fill,minmax(110px,1fr))]",
          )}
        >
          {assets.map((asset) => {
            const isSelected = selected.includes(asset.assetId);
            return (
              <li key={asset.assetId}>
                <button
                  type="button"
                  onClick={() => toggle(asset)}
                  aria-pressed={isSelected}
                  className={cn(
                    "relative w-full overflow-hidden rounded-xl border bg-nb-surface text-left transition-colors",
                    isSelected
                      ? "border-nb-green-dark ring-2 ring-nb-green"
                      : "border-nb-line hover:border-nb-green-dark",
                    apiKind === "music" && "flex items-center gap-2.5 p-2.5",
                  )}
                >
                  {apiKind === "music" ? (
                    <>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-nb-bg-2">
                        <Music className="size-4 text-nb-mute" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-nb-ink">
                          {asset.title}
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] text-nb-mute">
                          {formatDuration(asset.durationSeconds)}
                          <TranscriptionBadge
                            status={asset.transcriptionStatus}
                            error={asset.transcriptionError}
                          />
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      {apiKind === "images" ? (
                        // biome-ignore lint/performance/noImgElement: URL del backend, no un asset estático de Next
                        <img
                          src={asset.fileUrl}
                          alt=""
                          loading="lazy"
                          className="aspect-video w-full object-cover"
                        />
                      ) : (
                        <video
                          src={`${asset.fileUrl}#t=0.5`}
                          muted
                          playsInline
                          preload="metadata"
                          className="aspect-video w-full bg-black object-cover"
                        />
                      )}
                      <span className="block truncate px-2 py-1.5 text-[11.5px] font-medium text-nb-ink">
                        {asset.title}
                      </span>
                    </>
                  )}
                  {isSelected && (
                    <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-nb-green-dark text-white">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {allowUpload && (
        <UploadDropzone kind={apiKind} compact single={!props.multiple} onUploaded={pickUploaded} />
      )}
    </div>
  );
}
