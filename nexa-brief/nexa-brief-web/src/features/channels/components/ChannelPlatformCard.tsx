"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { buildConnectChannelUrl } from "../api/channels-service";
import { useDisconnectChannelMutation } from "../hooks/useDisconnectChannelMutation";
import type { ChannelAccount, ChannelPlatform } from "../types";
import { ChannelDetailsDialog } from "./ChannelDetailsDialog";

const PLATFORM_LABEL: Record<ChannelPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
};

const DEFAULT_ALIAS: Record<ChannelPlatform, string> = {
  youtube: "canal_1",
  tiktok: "cuenta_1",
  facebook: "pagina_1",
};

function nextSuggestedAlias(platform: ChannelPlatform, existingAliases: string[]): string {
  const base = platform === "youtube" ? "canal" : platform === "facebook" ? "pagina" : "cuenta";
  let n = 1;
  while (existingAliases.includes(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

function StatusBadge({ status }: { status: ChannelAccount["status"] }) {
  const t = useTranslations("channels");
  const isOk = status === "ok";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        isOk ? "bg-nb-green/15 text-nb-green-dark" : "bg-red-500/10 text-red-600",
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", isOk ? "bg-nb-green-dark" : "bg-red-600")}
      />
      {isOk ? t("statusActive") : t("statusExpired")}
    </span>
  );
}

function AccountRow({ platform, account }: { platform: ChannelPlatform; account: ChannelAccount }) {
  const t = useTranslations("channels");
  const disconnectMutation = useDisconnectChannelMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirmDisconnect = () => {
    disconnectMutation.mutate(
      { platform, alias: account.alias },
      { onSuccess: () => setConfirmOpen(false) },
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-nb-line px-3.5 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13px] font-semibold text-nb-ink">{account.name}</span>
        <span className="text-[11.5px] text-nb-mute">
          {account.alias} · {t("publishedCount", { count: account.publishedCount })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={account.status} />
        {account.status === "requires_reauth" && (
          <a
            href={buildConnectChannelUrl(platform, account.alias)}
            className="text-[12px] font-semibold text-nb-ink underline-offset-2 hover:underline"
          >
            {t("reconnect")}
          </a>
        )}
        <ChannelDetailsDialog platform={platform} account={account}>
          <button
            type="button"
            className="text-[12px] font-semibold text-nb-ink-soft underline-offset-2 hover:underline"
          >
            {t("viewDetails")}
          </button>
        </ChannelDetailsDialog>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="text-[12px] font-semibold text-red-600 underline-offset-2 hover:underline"
            >
              {t("disconnect")}
            </button>
          </DialogTrigger>
          <DialogContent className="rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-95">
            <DialogHeader>
              <DialogTitle className="text-nb-ink">
                {t("disconnectConfirmTitle", { name: account.name })}
              </DialogTitle>
              <DialogDescription className="text-nb-mute">
                {t("disconnectConfirmBody", {
                  platform: PLATFORM_LABEL[platform],
                  alias: account.alias,
                })}
              </DialogDescription>
            </DialogHeader>
            {disconnectMutation.isError && (
              <p className="text-[12.5px] text-red-600">{t("disconnectError")}</p>
            )}
            <DialogFooter className="bg-transparent">
              <DialogClose asChild>
                <button
                  type="button"
                  className="rounded-full border border-nb-line px-4 py-2 text-[12.5px] font-semibold text-nb-ink"
                >
                  {t("cancel")}
                </button>
              </DialogClose>
              <button
                type="button"
                disabled={disconnectMutation.isPending}
                onClick={handleConfirmDisconnect}
                className="rounded-full bg-red-600 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
              >
                {disconnectMutation.isPending ? t("disconnecting") : t("confirmDisconnect")}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export function ChannelPlatformCard({
  platform,
  accounts,
}: {
  platform: ChannelPlatform;
  accounts: ChannelAccount[];
}) {
  const t = useTranslations("channels");
  const [alias, setAlias] = useState(() =>
    nextSuggestedAlias(
      platform,
      accounts.map((a) => a.alias),
    ),
  );

  return (
    <div className="flex flex-col gap-3.5 rounded-[22px] bg-nb-surface p-5 shadow-[0_22px_40px_-16px_rgba(40,30,10,0.18),0_8px_16px_-4px_rgba(40,30,10,0.08),inset_0_1px_0_rgba(255,255,255,0.7)]">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-nb-ink">{PLATFORM_LABEL[platform]}</h3>
        <span className="text-[11.5px] text-nb-mute">
          {t("accountCount", { count: accounts.length })}
        </span>
      </div>

      {accounts.length > 0 ? (
        <div className="flex flex-col gap-2">
          {accounts.map((account) => (
            <AccountRow key={account.alias} platform={platform} account={account} />
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-nb-mute">{t("emptyState")}</p>
      )}

      <div className="flex items-center gap-2 border-t border-nb-line pt-3.5">
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder={DEFAULT_ALIAS[platform]}
          className="min-w-0 flex-1 rounded-full border border-nb-line bg-transparent px-3 py-1.5 text-[12.5px] text-nb-ink outline-none focus:border-nb-ink"
        />
        <a
          href={buildConnectChannelUrl(platform, alias || DEFAULT_ALIAS[platform])}
          className="nb-btn-pill shrink-0 px-4 py-1.5 text-[12.5px] font-semibold"
        >
          {t("addAccountButton")}
        </a>
      </div>
    </div>
  );
}
