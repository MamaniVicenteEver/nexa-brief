"use client";

import { FolderTree, ListPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { PLATFORM_META, PLATFORMS } from "../constants/platforms";
import { type ChannelCategoryGroup, UNASSIGNED_CATEGORY } from "../lib/category-groups";
import { AccountCard } from "./AccountCard";
import { PlatformIcon } from "./PlatformIcon";
import { secondaryButton, surfaceCard } from "./styles";

export function CategorySection({
  group,
  onEdit,
}: {
  group: ChannelCategoryGroup;
  onEdit: () => void;
}) {
  const t = useTranslations("channels.categoryView");
  const tm = useTranslations("channels.categoryManager");
  const platforms = PLATFORMS.filter((p) => group.accounts.some((a) => a.platform === p));
  return (
    <section
      aria-labelledby={`category-${group.id}`}
      className={cn(surfaceCard, "min-w-0 p-3 sm:p-6")}
    >
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-nb-green/20 text-nb-green-dark">
            <FolderTree className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id={`category-${group.id}`}
              className="wrap-anywhere text-[18px] font-extrabold tracking-[-0.015em] text-nb-ink"
            >
              {group.name}
            </h2>
            <p className="text-[12px] text-nb-mute">
              {t("accountCount", { count: group.accounts.length })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {group.id !== UNASSIGNED_CATEGORY && (
            <button type="button" className={secondaryButton} onClick={onEdit}>
              <ListPlus className="size-4" aria-hidden="true" />
              {tm("selectAccounts")}
            </button>
          )}
          {platforms.map((platform) => (
            <span
              key={platform}
              className="inline-flex items-center gap-1.5 rounded-full border border-nb-line px-2.5 py-1 text-[11.5px] font-semibold text-nb-ink-soft"
            >
              <PlatformIcon platform={platform} className="size-4" rounded="rounded-full" />
              {PLATFORM_META[platform].label}
            </span>
          ))}
        </div>
      </header>
      {group.accounts.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-3.5">
          {group.accounts.map((account) => (
            <div
              key={`${account.platform}:${account.alias}`}
              className="flex min-w-0 flex-col gap-2 [&>article]:flex-1"
            >
              <p className="flex items-center gap-1.5 px-1 text-[11.5px] font-semibold text-nb-mute">
                <PlatformIcon
                  platform={account.platform}
                  className="size-4"
                  rounded="rounded-full"
                />
                {PLATFORM_META[account.platform].label}
              </p>
              <AccountCard account={account} />
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-[18px] border border-dashed border-nb-line px-4 py-8 text-center text-[12.5px] text-nb-mute">
          {t("emptyCategory")}
        </p>
      )}
    </section>
  );
}
