"use client";

import { FileText, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LibraryAsset } from "@/features/library/api/library-assets-service";
import { cn } from "@/lib/utils";
import { useRetranscribe } from "../hooks/useResources";
import { formatDuration } from "../kinds";
import { TranscriptionBadge } from "./TranscriptionBadge";

interface AssetCardProps {
  asset: LibraryAsset;
  onEdit: () => void;
  onDelete: () => void;
  onShowLyrics?: () => void;
}

const iconButton =
  "flex size-8 items-center justify-center rounded-full text-nb-mute transition-colors hover:bg-nb-ink/[0.06] hover:text-nb-ink";

/** Tarjeta de un recurso con su reproducción nativa (audio/video) o miniatura. */
export function AssetCard({ asset, onEdit, onDelete, onShowLyrics }: AssetCardProps) {
  const t = useTranslations("resources.card");
  const retry = useRetranscribe();
  const isMusic = asset.kind === "music";
  const meta = [
    asset.width && asset.height ? `${asset.width}×${asset.height}` : "",
    formatDuration(asset.durationSeconds),
    asset.category,
  ].filter(Boolean);

  return (
    <article className="flex flex-col overflow-hidden rounded-nb-xs border border-nb-line bg-nb-surface">
      {asset.kind === "images" && (
        // biome-ignore lint/performance/noImgElement: URL del backend, no un asset estático de Next
        <img
          src={asset.fileUrl}
          alt={asset.title}
          loading="lazy"
          className="aspect-video w-full bg-nb-bg-2 object-cover"
        />
      )}
      {asset.kind === "videos" && (
        <video
          src={asset.fileUrl}
          controls
          muted
          playsInline
          preload="metadata"
          className="aspect-video w-full bg-black object-cover"
        />
      )}
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13.5px] font-semibold text-nb-ink" title={asset.title}>
              {asset.title}
            </h3>
            <p className="truncate text-[11.5px] text-nb-mute" title={asset.originalFilename}>
              {asset.originalFilename || asset.assetId}
            </p>
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={onEdit}
              aria-label={t("edit")}
              title={t("edit")}
              className={iconButton}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={t("delete")}
              title={t("delete")}
              className={cn(iconButton, "hover:text-red-600")}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
        {meta.length > 0 && <p className="text-[11.5px] text-nb-mute">{meta.join(" · ")}</p>}
        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {asset.tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-nb-bg-2 px-2 py-0.5 text-[11px] text-nb-ink-soft"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {isMusic && (
          <>
            {/** biome-ignore lint/a11y/useMediaCaption: la letra está en el visor de letra */}
            <audio src={asset.fileUrl} controls preload="none" className="mt-1 h-9 w-full" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TranscriptionBadge
                status={asset.transcriptionStatus}
                error={asset.transcriptionError}
                retrying={retry.isPending}
                onRetry={() =>
                  retry.mutate({ assetId: asset.assetId, language: asset.language || undefined })
                }
              />
              {asset.hasLyrics && onShowLyrics && (
                <button
                  type="button"
                  onClick={onShowLyrics}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold text-nb-green-dark hover:bg-nb-green/20"
                >
                  <FileText className="size-3.5" />
                  {t("lyrics")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
