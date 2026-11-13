"use client";

import { useQueries } from "@tanstack/react-query";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { getChannelCategoryMemberships } from "../api/channel-categories-service";
import {
  type ChannelCategory,
  type ChannelCategoryGroup,
  filterCategoryGroups,
  groupChannelsByCategory,
  type ManagedChannelCategory,
} from "../lib/category-groups";
import type { ChannelAccount, ChannelPlatform } from "../types";
import { CategorySection } from "./CategorySection";
import { ChannelsSkeleton } from "./ChannelsSkeleton";
import { secondaryButton } from "./styles";

export function CategoryChannelsView({
  accounts,
  categories,
  selectedCategory,
  platform,
  query,
  settings,
  onEdit,
}: {
  accounts: ChannelAccount[];
  categories: ChannelCategory[];
  selectedCategory: string | null;
  platform: ChannelPlatform | "all";
  query: string;
  settings: ManagedChannelCategory[];
  onEdit: (group: ChannelCategoryGroup) => void;
}) {
  const t = useTranslations("channels.categoryView");
  const links = useQueries({
    queries: categories
      .filter((category) => !category.id.startsWith("custom_"))
      .map((category) => ({
        queryKey: ["channelCategoryMemberships", category.id],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          getChannelCategoryMemberships(category.id, signal),
        staleTime: 60_000,
        retry: 1,
      })),
  });
  if (links.some((query) => query.isPending)) return <ChannelsSkeleton />;
  if (links.some((query) => query.isError))
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-[13px] text-amber-900"
      >
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{t("loadError")}</span>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => {
            for (const query of links) if (query.isError) void query.refetch();
          }}
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          {t("retry")}
        </button>
      </div>
    );
  const groups = groupChannelsByCategory(
    accounts,
    categories,
    links.flatMap((query) => query.data ?? []),
    t("unassigned"),
    settings,
  );
  const visible = filterCategoryGroups(groups, query, platform).filter(
    (group) => !selectedCategory || group.id === selectedCategory,
  );
  return (
    <div className="flex flex-col gap-5">
      {visible.length ? (
        visible.map((group) => (
          <CategorySection
            key={group.id}
            group={group}
            onEdit={() => {
              const full = groups.find((item) => item.id === group.id);
              if (full) onEdit(full);
            }}
          />
        ))
      ) : (
        <p
          role="status"
          className="rounded-2xl border border-dashed border-nb-line px-4 py-10 text-center text-[13px] text-nb-mute"
        >
          {t("noMatches")}
        </p>
      )}
    </div>
  );
}
