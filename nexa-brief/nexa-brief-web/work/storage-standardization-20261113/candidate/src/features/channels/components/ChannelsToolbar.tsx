"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { PLATFORM_META, PLATFORMS } from "../constants/platforms";
import type { ChannelPlatform } from "../types";
import { PlatformIcon } from "./PlatformIcon";

export type PlatformFilter = ChannelPlatform | "all";

export function ChannelsToolbar({
  filter,
  onFilterChange,
  counts,
  query,
  onQueryChange,
}: {
  filter: PlatformFilter;
  onFilterChange: (filter: PlatformFilter) => void;
  counts: Record<PlatformFilter, number>;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const t = useTranslations("channels.toolbar");
  const options: PlatformFilter[] = ["all", ...PLATFORMS];

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <fieldset
        aria-label={t("filterLabel")}
        className="inline-flex w-fit min-w-0 max-w-full gap-0.5 overflow-x-auto rounded-full border border-nb-line bg-nb-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {options.map((option) => {
          const active = filter === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange(option)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-3 pl-2 text-[12.5px] font-semibold transition-colors",
                option === "all" && "pl-3",
                active ? "bg-nb-ink text-[#fafaf7]" : "text-nb-ink-soft hover:bg-nb-ink/[0.05]",
              )}
            >
              {option !== "all" && (
                <PlatformIcon platform={option} rounded="rounded-full" className="size-5" />
              )}
              {option === "all" ? t("all") : PLATFORM_META[option].label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  active ? "bg-white/20" : "bg-nb-ink/[0.07] text-nb-mute",
                )}
              >
                {counts[option]}
              </span>
            </button>
          );
        })}
      </fieldset>

      <label className="relative w-full md:w-72">
        <span className="sr-only">{t("searchLabel")}</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-nb-mute" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-full border border-nb-line bg-nb-surface py-2.5 pr-9 pl-10 text-[13px] text-nb-ink outline-none transition-colors placeholder:text-nb-mute focus:border-nb-ink [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            aria-label={t("clear")}
            onClick={() => onQueryChange("")}
            className="absolute top-1/2 right-2.5 grid size-6 -translate-y-1/2 place-items-center rounded-full text-nb-mute hover:bg-nb-ink/[0.06] hover:text-nb-ink"
          >
            <X className="size-3.5" />
          </button>
        )}
      </label>
    </div>
  );
}
