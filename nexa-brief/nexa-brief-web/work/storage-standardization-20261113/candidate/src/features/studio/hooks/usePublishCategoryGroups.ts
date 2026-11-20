"use client";

import { useQueries } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCategories } from "@/features/categories";
import { getChannelCategoryMemberships } from "@/features/channels/api/channel-categories-service";
import { useChannelCategorySettings } from "@/features/channels/hooks/useChannelCategorySettings";
import { useChannels } from "@/features/channels/hooks/useChannels";
import {
  groupChannelsByCategory,
  mergeChannelCategories,
} from "@/features/channels/lib/category-groups";
import { toAccountOptions } from "@/shared/components/publish/brand-groups";

/** Same categories and explicit memberships as Canales, including custom categories. */
export function usePublishCategoryGroups() {
  const t = useTranslations("studio.thumbnails");
  const channels = useChannels();
  const catalog = useCategories();
  const settings = useChannelCategorySettings();
  const categories = mergeChannelCategories(catalog.data ?? [], settings.data ?? []);
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
  const queries = [channels, catalog, settings, ...links];
  const isLoading = queries.some((query) => query.isPending);
  const isError = queries.some((query) => query.isError);
  const groups =
    isLoading || isError
      ? []
      : groupChannelsByCategory(
          channels.data ?? [],
          categories,
          links.flatMap((query) => query.data ?? []),
          t("unassigned"),
          settings.data ?? [],
        )
          .filter((group) => group.accounts.length > 0)
          .map((group) => ({
            key: group.id,
            label: group.name,
            accounts: toAccountOptions(group.accounts),
          }));
  const unavailable = new Set(
    channels.data
      ?.filter((account) => account.status !== "ok")
      .map((account) => `${account.platform}:${account.alias}`),
  );
  return {
    groups,
    unavailable,
    isLoading,
    isError,
    retry: () => {
      for (const query of queries) if (query.isError) void query.refetch();
    },
  };
}
