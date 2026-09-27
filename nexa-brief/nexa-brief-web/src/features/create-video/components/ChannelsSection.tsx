"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import type { ChannelAccount, ChannelPlatform } from "@/features/channels";
import { useChannels } from "@/features/channels";
import { cn } from "@/lib/utils";
import type { CreateVideoFormValues } from "../schema";

const PLATFORM_LABEL: Record<ChannelPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
};

const PLATFORMS: ChannelPlatform[] = ["youtube", "tiktok", "facebook"];

function accountKey(account: ChannelAccount): string {
  return `${account.platform}:${account.alias}`;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative chevron, parent button conveys meaning via state
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-3.5 text-nb-mute transition-transform", open && "rotate-180")}
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function ChannelsSection({ form }: { form: UseFormReturn<CreateVideoFormValues> }) {
  const t = useTranslations("createVideo.channelsSection");
  const { data: channels, isLoading, isError } = useChannels();
  const [openPlatform, setOpenPlatform] = useState<ChannelPlatform | null>(null);
  const selected = useWatch({ control: form.control, name: "publishingAccounts" }) ?? [];

  function toggle(key: string) {
    const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
    form.setValue("publishingAccounts", next, { shouldDirty: true });
  }

  const byPlatform: Record<ChannelPlatform, ChannelAccount[]> = {
    youtube: [],
    tiktok: [],
    facebook: [],
  };
  for (const channel of channels ?? []) {
    byPlatform[channel.platform]?.push(channel);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[13.5px] font-bold tracking-[-0.01em] text-nb-ink">{t("title")}</span>

      {isError ? (
        <p className="text-[12.5px] leading-[1.5] text-nb-mute">{t("loadError")}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {PLATFORMS.map((platform) => {
            const accounts = byPlatform[platform];
            const open = openPlatform === platform;
            return (
              <div
                key={platform}
                className="rounded-2xl border border-nb-line bg-nb-surface px-3.5 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => setOpenPlatform(open ? null : platform)}
                  className="flex w-full items-center justify-between py-2.5"
                >
                  <span className="text-[13.5px] font-bold text-nb-ink">
                    {PLATFORM_LABEL[platform]}
                  </span>
                  <ChevronIcon open={open} />
                </button>
                {open && (
                  <div className="flex flex-col gap-1 border-t border-nb-line pt-2.5 pb-2">
                    {isLoading ? (
                      <div className="px-2 py-2 text-[12.5px] text-nb-mute">{t("loading")}</div>
                    ) : accounts.length ? (
                      accounts.map((account) => {
                        const key = accountKey(account);
                        const disabled = account.status === "requires_reauth";
                        return (
                          <label
                            key={key}
                            className={cn(
                              "flex items-center gap-2.5 rounded-[10px] px-2 py-2 text-[13px]",
                              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                            )}
                          >
                            <input
                              type="checkbox"
                              disabled={disabled}
                              checked={selected.includes(key)}
                              onChange={() => toggle(key)}
                              className="size-4 shrink-0"
                            />
                            <span className="font-semibold text-nb-ink">{account.alias}</span>
                            <span className="ml-1 text-xs text-nb-mute">
                              {disabled ? t("tokenExpired") : account.name}
                            </span>
                          </label>
                        );
                      })
                    ) : (
                      <div className="px-2 py-2 text-[12.5px] text-nb-mute">{t("noAccounts")}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[12.5px] leading-[1.5] text-nb-mute">
        {selected.length > 0
          ? t("autoPublishHint", { count: selected.length })
          : t("manualPublishHint")}
      </p>
    </div>
  );
}
