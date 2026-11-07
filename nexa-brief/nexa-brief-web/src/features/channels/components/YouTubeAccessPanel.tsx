"use client";

import { ArrowUpRight, RefreshCw, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useVerifyChannelMutation } from "../hooks/useVerifyChannelMutation";
import { formatRelativeTime } from "../lib/channels";
import type { ChannelAccount } from "../types";

export function YouTubeAccessPanel({
  account,
  compact = false,
}: {
  account: ChannelAccount;
  compact?: boolean;
}) {
  const t = useTranslations("channels.youtubeAccess");
  const locale = useLocale();
  const verify = useVerifyChannelMutation();
  const access = account.youtubeFeatureAccess;
  const state = access?.stale ? "stale" : (access?.state ?? "unknown");
  const thumbnail = account.youtubeThumbnailCapability?.state ?? "unknown";

  return (
    <section
      aria-label={t("title")}
      className="rounded-xl border border-nb-line bg-nb-ink/[0.025] p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-nb-ink">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          {t("title")}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            state === "enabled"
              ? "bg-nb-green/15 text-nb-green-dark"
              : state === "unknown"
                ? "bg-nb-ink/5 text-nb-mute"
                : "bg-amber-500/15 text-amber-800",
          )}
        >
          {t(`state.${state}`)}
        </span>
      </div>
      <dl className="mt-2 wrap-anywhere grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-2 gap-y-1 text-[11px]">
        <dt className="text-nb-mute">{t("longVideos")}</dt>
        <dd className="text-right font-medium text-nb-ink-soft">
          {t(`long.${access?.long_uploads_status ?? "unknown"}`)}
        </dd>
        <dt className="text-nb-mute">{t("thumbnails")}</dt>
        <dd className="text-right font-medium text-nb-ink-soft">{t(`thumbnail.${thumbnail}`)}</dd>
      </dl>
      {!compact && (
        <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-nb-mute">
          <p className="font-medium text-nb-ink-soft">{t(`reason.${state}`)}</p>
          <p>{t("phoneHint")}</p>
          <p>{t("hint")}</p>
          <p>{t("advancedHint")}</p>
          <p className="text-[11px]">
            {access?.checked_at
              ? t("checked", { time: formatRelativeTime(access.checked_at, locale) })
              : t("never")}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={verify.isPending || account.status === "requires_reauth"}
              className="inline-flex items-center gap-1.5 rounded-full border border-nb-line px-3 py-1.5 font-semibold text-nb-ink-soft disabled:opacity-50"
              onClick={() =>
                verify.mutate(
                  { platform: "youtube", alias: account.alias },
                  {
                    onSuccess: (result) => {
                      if (result.status !== "ok") toast.error(t("refreshFailed"));
                    },
                    onError: () => toast.error(t("refreshFailed")),
                  },
                )
              }
            >
              <RefreshCw className={cn("size-3", verify.isPending && "animate-spin")} />
              {verify.isPending ? t("refreshing") : t("refresh")}
            </button>
            <a
              href={`https://studio.youtube.com/channel/${encodeURIComponent(account.targetId)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold underline"
            >
              {t("openStudio")}
              <ArrowUpRight className="size-3" />
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
