"use client";

import { Film, Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ReferenceChatActions } from "@/features/prototypes";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { formatRelativeDate } from "../lib/relative-date";
import { previewTarget, sandboxFileUrl } from "../lib/urls";
import type { SandboxItem } from "../types";
import { PromoteButton } from "./PromoteButton";
import { SandboxPreviewModal } from "./SandboxPreviewModal";

export function SandboxItemCard({ item, folderLabel }: { item: SandboxItem; folderLabel: string }) {
  const t = useTranslations("sandbox");
  const locale = useLocale();
  const target = previewTarget(item);
  const firstVideo = item.videos[0];
  const thumbnailUrl = item.thumbnailUrl ? resolveApiUrl(item.thumbnailUrl) : null;
  const hasMediaCover = Boolean(thumbnailUrl || firstVideo);
  const relativeDate = formatRelativeDate(item.updatedAt, locale);

  return (
    <article className="flex flex-col overflow-hidden rounded-[10px] border border-black/5 bg-nb-surface shadow-[0_8px_20px_-16px_rgba(40,30,10,0.16),0_2px_8px_-5px_rgba(40,30,10,0.05),inset_0_1px_0_rgba(255,255,255,0.45)]">
      <SandboxPreviewModal
        target={target}
        title={item.title}
        folder={item.folder}
        id={item.id}
        showInfo={item.kind !== "reference"}
      >
        <button
          type="button"
          disabled={!target}
          aria-label={t("openPreview", { title: item.title })}
          className="group flex cursor-pointer flex-col text-left disabled:cursor-default"
        >
          <div className="relative aspect-[1.65] w-full overflow-hidden bg-black">
            {thumbnailUrl ? (
              // biome-ignore lint/performance/noImgElement: sandbox poster served by the backend
              <img
                src={thumbnailUrl}
                alt={item.title}
                loading="lazy"
                className="size-full object-cover"
              />
            ) : firstVideo ? (
              <video
                src={`${resolveApiUrl(sandboxFileUrl(item.path, firstVideo))}#t=1`}
                preload="metadata"
                muted
                aria-label={t("videoPoster", { title: item.title })}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-2 bg-nb-bg-2 text-nb-mute">
                <Film className="size-8" />
                <span className="text-xs">{t(`kind.${item.kind}`)}</span>
              </div>
            )}
            {target && hasMediaCover && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="flex size-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                  <Play className="size-5 fill-current" />
                </span>
              </span>
            )}
            <span className="absolute top-2 left-2 rounded-full bg-black/65 px-2 py-0.5 text-[9.5px] font-bold text-white uppercase">
              {t(`kind.${item.kind}`)}
            </span>
          </div>
          <div className="flex min-h-16 w-full flex-col gap-1 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-[12px] font-bold tracking-[-0.015em] text-nb-ink">
                {item.title}
              </h3>
              {item.status && (
                <span className="shrink-0 rounded-full bg-nb-green/70 px-2 py-0.5 text-[9px] font-bold text-nb-green-dark">
                  {item.status === "listo" ? t("status.ready") : item.status}
                </span>
              )}
            </div>
            {relativeDate && (
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[10px] text-nb-mute">
                  {t("updatedAt", { date: relativeDate })}
                </p>
                {item.kind !== "reference" && item.totalTokens !== null && (
                  <TokenChip
                    label={t("tokenChip", { count: compactTokens(item.totalTokens, locale) })}
                  />
                )}
              </div>
            )}
            {!relativeDate && item.kind !== "reference" && item.totalTokens !== null && (
              <TokenChip
                label={t("tokenChip", { count: compactTokens(item.totalTokens, locale) })}
              />
            )}
          </div>
        </button>
      </SandboxPreviewModal>
      {item.kind === "reference" ? (
        <>
          <div className="flex items-center justify-between gap-2 border-t border-nb-line/70 px-3 py-2">
            <span className="text-[10px] font-bold tracking-wide text-nb-mute uppercase">
              {folderLabel}
            </span>
            <span className="text-xs font-semibold text-nb-ink-soft">{t("referenceForAi")}</span>
          </div>
          <ReferenceChatActions
            category={
              (item.subcategory ?? "otros") as Parameters<
                typeof ReferenceChatActions
              >[0]["category"]
            }
            slug={item.id}
          />
        </>
      ) : (
        <PromoteButton item={item} folderLabel={folderLabel} />
      )}
    </article>
  );
}

function compactTokens(value: number, locale: string): string {
  const units = [
    { threshold: 1_000_000_000, suffix: "B" },
    { threshold: 1_000_000, suffix: "M" },
    { threshold: 1_000, suffix: "K" },
  ];
  const unit = units.find(({ threshold }) => value >= threshold);
  if (!unit) return new Intl.NumberFormat(locale).format(value);
  const count = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    value / unit.threshold,
  );
  return `${count} ${unit.suffix}`;
}

function TokenChip({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-full bg-nb-accent-gold/30 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-nb-ink">
      {label}
    </span>
  );
}
