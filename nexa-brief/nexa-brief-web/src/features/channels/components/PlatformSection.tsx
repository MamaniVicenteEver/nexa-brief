"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { PLATFORM_META } from "../constants/platforms";
import type { ChannelAccount, ChannelPlatform } from "../types";
import { AccountCard } from "./AccountCard";
import { ConnectAccountDialog } from "./ConnectAccountDialog";
import { PlatformIcon } from "./PlatformIcon";
import { surfaceCard } from "./styles";

export function PlatformSection({
  platform,
  accounts,
  totalAccounts,
  aliasesByPlatform,
  filtered,
}: {
  platform: ChannelPlatform;
  /** Accounts after search filtering. */
  accounts: ChannelAccount[];
  /** Accounts before search filtering — drives the header count and empty-state copy. */
  totalAccounts: number;
  aliasesByPlatform: Record<ChannelPlatform, string[]>;
  filtered: boolean;
}) {
  const t = useTranslations("channels.section");
  const label = PLATFORM_META[platform].label;
  const reauth = accounts.filter((a) => a.status === "requires_reauth").length;

  const addTile = (
    <ConnectAccountDialog defaultPlatform={platform} aliasesByPlatform={aliasesByPlatform}>
      <button
        type="button"
        className={cn(
          "flex min-h-[236px] flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed border-nb-line p-6 text-center transition-colors hover:border-nb-mute hover:bg-white/35",
        )}
      >
        <span className="grid size-10 place-items-center rounded-full bg-nb-ink text-[#fafaf7]">
          <Plus className="size-4.5" />
        </span>
        <span className="text-[13.5px] font-bold text-nb-ink">
          {platform === "instagram"
            ? totalAccounts === 0
              ? t("connectInstagram")
              : t("connectAnotherInstagram")
            : totalAccounts === 0
              ? t("connectFirst", { platform: label })
              : t("connectAnother")}
        </span>
        <span className="max-w-[220px] text-[12px] leading-[1.5] text-nb-mute">
          {platform === "instagram" ? t("instagramConnectHint") : t("connectHint")}
        </span>
      </button>
    </ConnectAccountDialog>
  );

  return (
    <section aria-labelledby={`section-${platform}`} className={cn(surfaceCard, "p-5 sm:p-6")}>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PlatformIcon platform={platform} className="size-10" />
          <div>
            <h2
              id={`section-${platform}`}
              className="text-[16px] font-extrabold tracking-[-0.015em] text-nb-ink"
            >
              {label}
            </h2>
            <p className="text-[12px] text-nb-mute">
              {t("accountCount", { count: totalAccounts })}
              {reauth > 0 && (
                <span className="font-semibold text-red-600">
                  {" "}
                  · {t("reauthCount", { count: reauth })}
                </span>
              )}
            </p>
          </div>
        </div>
        <ConnectAccountDialog defaultPlatform={platform} aliasesByPlatform={aliasesByPlatform}>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-nb-line px-3.5 py-2 text-[12.5px] font-semibold text-nb-ink transition-colors hover:bg-nb-ink/[0.04]"
          >
            <Plus className="size-3.5" />
            {platform === "instagram" ? t("connectInstagramShort") : t("addAccount")}
          </button>
        </ConnectAccountDialog>
      </header>

      {platform === "instagram" && (
        <p className="mb-4 max-w-3xl rounded-xl border border-nb-line bg-white/35 px-4 py-3 text-[12.5px] leading-[1.55] text-nb-mute">
          {t("instagramHint")}
        </p>
      )}

      {filtered && accounts.length === 0 ? (
        <p className="rounded-[18px] border border-dashed border-nb-line px-4 py-8 text-center text-[12.5px] text-nb-mute">
          {t("noMatches")}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5">
          {accounts.map((account) => (
            <AccountCard key={account.alias} account={account} />
          ))}
          {!filtered && addTile}
        </div>
      )}
    </section>
  );
}
