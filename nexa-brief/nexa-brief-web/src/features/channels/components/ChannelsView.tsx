"use client";

import { Plus, TriangleAlert, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PLATFORMS } from "../constants/platforms";
import { useChannels } from "../hooks/useChannels";
import { useConnectedAccountNotice } from "../hooks/useConnectedAccountNotice";
import { groupByPlatform, matchesQuery } from "../lib/channels";
import type { ChannelPlatform } from "../types";
import { ChannelsSkeleton } from "./ChannelsSkeleton";
import { ChannelsSummary } from "./ChannelsSummary";
import { ChannelsToolbar, type PlatformFilter } from "./ChannelsToolbar";
import { ConnectAccountDialog } from "./ConnectAccountDialog";
import { PlatformSection } from "./PlatformSection";
import { primaryButton } from "./styles";

function Banner({
  tone,
  icon: Icon,
  children,
}: {
  tone: "error" | "warning";
  icon: typeof WifiOff;
  children: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3 text-[13px] font-medium",
        tone === "error"
          ? "border-red-500/20 bg-red-500/5 text-red-700"
          : "border-amber-500/25 bg-amber-400/10 text-amber-800",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {children}
    </div>
  );
}

export function ChannelsView() {
  const t = useTranslations("channels");
  const { data, isLoading, isError, isFetching } = useChannels({ poll: true });
  const [filter, setFilter] = useState<PlatformFilter>("all");
  const [query, setQuery] = useState("");
  useConnectedAccountNotice();

  const channels = data ?? [];
  const groups = useMemo(() => groupByPlatform(data ?? []), [data]);
  const aliasesByPlatform = useMemo(
    () =>
      Object.fromEntries(PLATFORMS.map((p) => [p, groups[p].map((a) => a.alias)])) as Record<
        ChannelPlatform,
        string[]
      >,
    [groups],
  );
  const counts = useMemo(
    () =>
      ({
        all: channels.length,
        ...Object.fromEntries(PLATFORMS.map((p) => [p, groups[p].length])),
      }) as Record<PlatformFilter, number>,
    [channels.length, groups],
  );
  const reauthCount = channels.filter((c) => c.status === "requires_reauth").length;
  const visiblePlatforms = filter === "all" ? PLATFORMS : [filter];
  const searching = query.trim().length > 0;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1280px] flex-col gap-6 px-4 pt-22 pb-16 sm:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-nb-sans text-[clamp(22px,2.6vw,30px)] font-extrabold tracking-[-0.025em] text-nb-ink">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-[560px] text-[13.5px] leading-[1.5] text-nb-mute">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isFetching && !isLoading && (
            <span className="flex items-center gap-1.5 text-[11.5px] text-nb-mute">
              <span className="size-1.5 animate-pulse rounded-full bg-nb-mute" />
              {t("updating")}
            </span>
          )}
          <ConnectAccountDialog aliasesByPlatform={aliasesByPlatform}>
            <button type="button" className={primaryButton}>
              <Plus className="size-4" />
              {t("connectAccount")}
            </button>
          </ConnectAccountDialog>
        </div>
      </header>

      {isError && (
        <Banner tone="error" icon={WifiOff}>
          {t("connectionError")}
        </Banner>
      )}
      {!isError && reauthCount > 0 && (
        <Banner tone="warning" icon={TriangleAlert}>
          {t("reauthBanner", { count: reauthCount })}
        </Banner>
      )}

      {isLoading ? (
        <ChannelsSkeleton />
      ) : (
        <>
          <ChannelsSummary channels={channels} />
          <ChannelsToolbar
            filter={filter}
            onFilterChange={setFilter}
            counts={counts}
            query={query}
            onQueryChange={setQuery}
          />
          <div className="flex flex-col gap-5">
            {visiblePlatforms.map((platform) => (
              <PlatformSection
                key={platform}
                platform={platform}
                accounts={groups[platform].filter((a) => matchesQuery(a, query))}
                totalAccounts={groups[platform].length}
                aliasesByPlatform={aliasesByPlatform}
                filtered={searching}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
