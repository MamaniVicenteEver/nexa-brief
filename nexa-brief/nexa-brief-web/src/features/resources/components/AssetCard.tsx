"use client";

import { FileText, Pencil, Trash2, Volume2 } from "lucide-react";
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
  const isSound = asset.kind === "sounds";
  const meta = [
    asset.width && asset.height ? `${asset.width}×${asset.height}` : "",
    formatDuration(asset.durationSeconds),
    asset.category === "sound_effects" ? t("soundCategory") : asset.category,
  ].filter(Boolean);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-nb-line bg-nb-surface shadow-[0_3px_16px_-10px_rgba(0,0,0,0.18)] transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.22)]">
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
      <div className="flex flex-1 flex-col gap-3 p-5">
        {isSound && (
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-nb-green-dark">
              <Volume2 className="size-4" />
              {t("sound")}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                asset.approvalStatus === "approved"
                  ? "bg-nb-green/20 text-nb-green-dark"
                  : "bg-nb-bg-2 text-nb-mute",
              )}
            >
              {t(`status.${asset.approvalStatus ?? "pending"}`)}
            </span>
          </div>
        )}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3
              className="break-words text-[16px] leading-snug font-semibold text-nb-ink"
              title={asset.title}
            >
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
        {asset.description && (
          <p className="whitespace-pre-line break-words text-[13px] leading-relaxed text-nb-ink-soft">
            {asset.description}
          </p>
        )}
        {isSound && asset.recommendedUses.length > 0 && (
          <div className="rounded-xl bg-nb-bg/70 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-nb-mute">
              {t("recommendedUses")}
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-nb-ink-soft">
              {asset.recommendedUses.map((use) => (
                <li key={use}>{use}</li>
              ))}
            </ul>
          </div>
        )}
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
        {isSound && (
          <div className="mt-auto border-t border-nb-line pt-3">
            {/* biome-ignore lint/a11y/useMediaCaption: la descripción del efecto aparece completa en esta ficha */}
            <audio
              aria-label={asset.title}
              src={asset.fileUrl}
              controls
              preload="metadata"
              className="h-10 w-full"
            />
            <p className="mt-2 text-[11px] text-nb-mute">
              {[
                asset.provider,
                asset.licenseNote !== "unknown" ? asset.licenseNote : "",
                t("usageCount", { count: asset.usageCount }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
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
