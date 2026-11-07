"use client";

import { FolderPlus, ListFilter, Plus, TriangleAlert, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useCategories } from "@/features/categories";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { PLATFORM_META, PLATFORMS } from "../constants/platforms";
import { useChannelCategorySettings } from "../hooks/useChannelCategorySettings";
import { useChannels } from "../hooks/useChannels";
import { useConnectedAccountNotice } from "../hooks/useConnectedAccountNotice";
import {
  type ChannelCategoryGroup,
  mergeChannelCategories,
  UNASSIGNED_CATEGORY,
} from "../lib/category-groups";
import { groupByPlatform, matchesQuery } from "../lib/channels";
import type { ChannelPlatform } from "../types";
import { CategoryChannelsView } from "./CategoryChannelsView";
import { ChannelsSkeleton } from "./ChannelsSkeleton";
import { ChannelsSummary } from "./ChannelsSummary";
import { ChannelsToolbar, type PlatformFilter } from "./ChannelsToolbar";
import { ConnectAccountDialog } from "./ConnectAccountDialog";
import { ManageCategoryDialog } from "./ManageCategoryDialog";
import { PlatformSection } from "./PlatformSection";
import { primaryButton, secondaryButton } from "./styles";

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
  const categoryQuery = useCategories();
  const [categoryView, setCategoryView] = useState("platforms");
  const categorySettings = useChannelCategorySettings(categoryView !== "platforms");
  const categories = mergeChannelCategories(categoryQuery.data ?? [], categorySettings.data ?? []);
  const [editingCategory, setEditingCategory] = useState<ChannelCategoryGroup | null | undefined>(
    undefined,
  );
  const tm = useTranslations("channels.categoryManager");
  const tc = useTranslations("channels.categoryView");
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
  const searching = query.trim().length > 0;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingPlatforms = searching
    ? PLATFORMS.filter((platform) =>
        PLATFORM_META[platform].label.toLocaleLowerCase().includes(normalizedQuery),
      )
    : [];
  // Searching for a platform name should reveal its empty section and connect action,
  // even before the first account has been linked.
  const visiblePlatforms =
    filter !== "all" ? [filter] : matchingPlatforms.length > 0 ? matchingPlatforms : PLATFORMS;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-6 px-4 pt-22 pb-16 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-nb-sans text-[clamp(22px,2.6vw,30px)] font-extrabold tracking-[-0.025em] text-nb-ink">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-[560px] text-[13.5px] leading-[1.5] text-nb-mute">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-3">
          {isFetching && !isLoading && (
            <span className="flex items-center gap-1.5 text-[11.5px] text-nb-mute">
              <span className="size-1.5 animate-pulse rounded-full bg-nb-mute" />
              {t("updating")}
            </span>
          )}
          <Select value={categoryView} onValueChange={setCategoryView}>
            <SelectTrigger
              aria-label={tc("filter")}
              className="h-10 max-w-full rounded-full border-nb-line bg-nb-surface px-4 text-[13px] font-semibold text-nb-ink"
            >
              <ListFilter className="size-4" aria-hidden="true" />
              <SelectValue>
                {categoryView === "platforms"
                  ? tc("filter")
                  : categoryView === "categories"
                    ? tc("all")
                    : categoryView === UNASSIGNED_CATEGORY
                      ? tc("unassigned")
                      : categories.find((c) => c.id === categoryView)?.displayName}
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" align="end" className="max-h-80 bg-nb-surface">
              <SelectItem value="platforms">{tc("platforms")}</SelectItem>
              <SelectItem value="categories">{tc("all")}</SelectItem>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>{tc("categoryLabel")}</SelectLabel>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.displayName}
                  </SelectItem>
                ))}
                <SelectItem value={UNASSIGNED_CATEGORY}>{tc("unassigned")}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          {categoryView !== "platforms" && (
            <button
              type="button"
              className={secondaryButton}
              disabled={
                categoryQuery.isPending ||
                categorySettings.isPending ||
                categoryQuery.isError ||
                categorySettings.isError ||
                isLoading ||
                isError
              }
              onClick={() => setEditingCategory(null)}
            >
              <FolderPlus className="size-4" aria-hidden="true" />
              {tm("create")}
            </button>
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
          {categoryView !== "platforms" ? (
            categoryQuery.isPending || categorySettings.isPending ? (
              <ChannelsSkeleton />
            ) : categoryQuery.isError || categorySettings.isError ? (
              <div
                role="alert"
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-[13px] text-amber-900"
              >
                <span className="min-w-0 flex-1">{tc("loadError")}</span>
                <button
                  type="button"
                  className={primaryButton}
                  onClick={() => {
                    void categoryQuery.refetch();
                    void categorySettings.refetch();
                  }}
                >
                  {tc("retry")}
                </button>
              </div>
            ) : (
              <CategoryChannelsView
                accounts={channels}
                categories={categories}
                selectedCategory={categoryView === "categories" ? null : categoryView}
                platform={filter}
                query={query}
                settings={categorySettings.data ?? []}
                onEdit={setEditingCategory}
              />
            )
          ) : (
            <div className="flex flex-col gap-5">
              {visiblePlatforms.map((platform) => (
                <PlatformSection
                  key={platform}
                  platform={platform}
                  accounts={groups[platform].filter((a) => matchesQuery(a, query))}
                  totalAccounts={groups[platform].length}
                  aliasesByPlatform={aliasesByPlatform}
                  filtered={
                    searching &&
                    !PLATFORM_META[platform].label.toLocaleLowerCase().includes(normalizedQuery)
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
      {editingCategory !== undefined && (
        <ManageCategoryDialog
          accounts={channels}
          category={editingCategory}
          settings={categorySettings.data?.find((item) => item.id === editingCategory?.id)}
          onClose={() => setEditingCategory(undefined)}
          onSaved={(id) => {
            if (editingCategory === null) {
              setFilter("all");
              setQuery("");
            }
            setCategoryView(id);
            setEditingCategory(undefined);
          }}
        />
      )}
    </div>
  );
}
