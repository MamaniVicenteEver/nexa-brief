"use client";

import { useTranslations } from "next-intl";
import { useChannels } from "../hooks/useChannels";
import type { ChannelAccount, ChannelPlatform } from "../types";
import { ChannelPlatformCard } from "./ChannelPlatformCard";

const PLATFORMS: ChannelPlatform[] = ["youtube", "tiktok", "facebook"];

function groupByPlatform(channels: ChannelAccount[]): Record<ChannelPlatform, ChannelAccount[]> {
  const groups: Record<ChannelPlatform, ChannelAccount[]> = {
    youtube: [],
    tiktok: [],
    facebook: [],
  };
  for (const channel of channels) {
    groups[channel.platform]?.push(channel);
  }
  return groups;
}

export function ChannelsView() {
  const t = useTranslations("channels");
  const { data: channels, isLoading, isError, isFetching } = useChannels({ poll: true });
  const groups = groupByPlatform(channels ?? []);
  const reauthCount = (channels ?? []).filter((c) => c.status === "requires_reauth").length;

  return (
    <div className="mx-auto max-w-[1280px] px-10 pt-[92px] pb-16">
      <div className="flex items-center justify-between gap-4 pb-4.5">
        <h1 className="font-nb-sans text-[clamp(20px,2.4vw,26px)] font-extrabold tracking-[-0.02em] text-nb-ink">
          {t("title")}
        </h1>
        {isFetching && !isLoading && (
          <span className="text-[11.5px] text-nb-mute">{t("updating")}</span>
        )}
      </div>

      {isError && (
        <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] font-medium text-red-600">
          {t("connectionError")}
        </div>
      )}

      {!isError && reauthCount > 0 && (
        <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] font-medium text-red-600">
          {t("reauthBanner", { count: reauthCount })}
        </div>
      )}

      {isLoading ? (
        <p className="text-[13px] text-nb-mute">{t("loading")}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
          {PLATFORMS.map((platform) => (
            <ChannelPlatformCard key={platform} platform={platform} accounts={groups[platform]} />
          ))}
        </div>
      )}
    </div>
  );
}
