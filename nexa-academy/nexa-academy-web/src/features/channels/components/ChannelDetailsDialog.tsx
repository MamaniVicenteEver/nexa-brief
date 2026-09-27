"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { useChannelVideos } from "../hooks/useChannelVideos";
import type { ChannelAccount, ChannelPlatform } from "../types";

const PLATFORM_LABEL: Record<ChannelPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
};

function formatExpiry(
  t: ReturnType<typeof useTranslations>,
  expiresInSeconds: number | null,
): string {
  if (expiresInSeconds === null) return t("dialog.neverExpires");
  if (expiresInSeconds <= 0) return t("dialog.expired");
  const hours = expiresInSeconds / 3600;
  if (hours < 1) return t("dialog.expiresInMinutes", { minutes: Math.round(expiresInSeconds / 60) });
  if (hours < 48) return t("dialog.expiresInHours", { hours: Math.round(hours) });
  return t("dialog.expiresInDays", { days: Math.round(hours / 24) });
}

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-nb-line py-2 last:border-b-0">
      <span className="text-[12px] text-nb-mute">{label}</span>
      <span className="text-[12.5px] font-semibold text-nb-ink">{value}</span>
    </div>
  );
}

function PublishedVideosList({
  platform,
  alias,
  enabled,
}: {
  platform: ChannelPlatform;
  alias: string;
  enabled: boolean;
}) {
  const t = useTranslations("channels");
  const { data: videos, isLoading } = useChannelVideos(platform, alias, enabled);

  if (isLoading) {
    return <p className="text-[12px] text-nb-mute">{t("dialog.loadingVideos")}</p>;
  }

  if (!videos || videos.length === 0) {
    return <p className="text-[12px] text-nb-mute">{t("dialog.noVideos")}</p>;
  }

  return (
    <div className="flex max-h-50 flex-col gap-1.5 overflow-y-auto">
      {videos.map((video) => (
        <a
          key={video.postId}
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-[10px] px-2.5 py-1.5 text-nb-ink no-underline hover:bg-nb-line/40"
        >
          <span className="truncate text-[12.5px] font-semibold">{video.title}</span>
          <span className="shrink-0 text-[11px] text-nb-mute">{formatDate(video.publishedAt)}</span>
        </a>
      ))}
    </div>
  );
}

export function ChannelDetailsDialog({
  platform,
  account,
  children,
}: {
  platform: ChannelPlatform;
  account: ChannelAccount;
  children: React.ReactNode;
}) {
  const t = useTranslations("channels");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-nb-sans text-[16px] text-nb-ink">{account.name}</DialogTitle>
          <DialogDescription className="text-nb-mute">
            {PLATFORM_LABEL[platform]} · {account.alias}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col">
          <DetailRow label={t("dialog.platform")} value={PLATFORM_LABEL[platform]} />
          <DetailRow label={t("dialog.alias")} value={account.alias} />
          <DetailRow label={t("dialog.name")} value={account.name} />
          <DetailRow label={t("dialog.platformId")} value={account.targetId || "—"} />
          <DetailRow
            label={t("dialog.status")}
            value={account.status === "ok" ? t("statusActive") : t("statusExpired")}
          />
          <DetailRow
            label={t("dialog.tokenExpiry")}
            value={formatExpiry(t, account.expiresInSeconds)}
          />
          <DetailRow
            label={t("dialog.autoRenewal")}
            value={account.hasRefreshToken ? t("dialog.yes") : t("dialog.no")}
          />
          <DetailRow label={t("dialog.publishedVideos")} value={account.publishedCount} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold tracking-wide text-nb-mute uppercase">
            {t("dialog.recentVideos")}
          </span>
          <PublishedVideosList platform={platform} alias={account.alias} enabled={open} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
