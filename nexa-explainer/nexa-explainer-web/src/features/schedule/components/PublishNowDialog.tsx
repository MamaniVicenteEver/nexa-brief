"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useChannels } from "@/features/channels/hooks/useChannels";
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
import { usePublishNowMutation } from "../hooks/usePublishNowMutation";
import type { ChannelPlatform } from "../types";

const PLATFORMS: ChannelPlatform[] = ["youtube", "tiktok", "facebook"];

export function PublishNowDialog({
  jobId,
  jobTitle,
  children,
}: {
  jobId: string;
  jobTitle: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("schedule");
  const [open, setOpen] = useState(false);
  const { data: channels } = useChannels();
  const publishMutation = usePublishNowMutation();

  const okChannels = (channels ?? []).filter((c) => c.status === "ok");
  const [platform, setPlatform] = useState<ChannelPlatform>("youtube");
  const [accountAlias, setAccountAlias] = useState("");

  const accountsForPlatform = okChannels.filter((c) => c.platform === platform);
  const isValid = accountAlias.trim() !== "";

  const handleConfirm = () => {
    if (!isValid) return;
    publishMutation.mutate({ jobId, platform, accountAlias });
  };

  const result = publishMutation.data;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          publishMutation.reset();
          setAccountAlias("");
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-95">
        <DialogHeader>
          <DialogTitle className="text-nb-ink">{t("publishNow.title")}</DialogTitle>
          <DialogDescription className="text-nb-mute">
            {t("publishNow.description", { jobTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="publishPlatform" className="text-[11px] font-semibold text-nb-mute uppercase">
              {t("publishNow.platformLabel")}
            </label>
            <select
              id="publishPlatform"
              value={platform}
              onChange={(e) => {
                setPlatform(e.target.value as ChannelPlatform);
                setAccountAlias("");
              }}
              className="rounded-xl border border-nb-line bg-transparent px-3 py-2 text-[13px] text-nb-ink outline-none focus:border-nb-ink"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {t(`platforms.${p}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="publishAccount" className="text-[11px] font-semibold text-nb-mute uppercase">
              {t("publishNow.accountLabel")}
            </label>
            <select
              id="publishAccount"
              value={accountAlias}
              onChange={(e) => setAccountAlias(e.target.value)}
              className="rounded-xl border border-nb-line bg-transparent px-3 py-2 text-[13px] text-nb-ink outline-none focus:border-nb-ink"
            >
              <option value="">{t("publishNow.chooseAccount")}</option>
              {accountsForPlatform.map((account) => (
                <option key={account.alias} value={account.alias}>
                  {account.name} ({account.alias})
                </option>
              ))}
            </select>
          </div>
        </div>

        {accountsForPlatform.length === 0 && (
          <p className="text-[12.5px] text-nb-mute">
            {t("publishNow.noAccounts", { platform: t(`platforms.${platform}`) })}
          </p>
        )}

        {publishMutation.isError && (
          <p className="text-[12.5px] text-red-600">{t("publishNow.publishError")}</p>
        )}
        {result && result.status === "published" && (
          <p className="text-[12.5px] font-semibold text-nb-green-dark">
            {t("publishNow.success")}
          </p>
        )}
        {result && result.status === "failed" && (
          <p className="text-[12.5px] text-red-600">
            {result.error ?? t("publishNow.genericFailure")}
          </p>
        )}

        <DialogFooter className="bg-transparent">
          <DialogClose asChild>
            <button
              type="button"
              className="rounded-full border border-nb-line px-4 py-2 text-[12.5px] font-semibold text-nb-ink"
            >
              {result?.status === "published" ? t("common.close") : t("common.cancel")}
            </button>
          </DialogClose>
          <button
            type="button"
            disabled={!isValid || publishMutation.isPending}
            onClick={handleConfirm}
            className="nb-btn-pill px-4 py-2 text-[12.5px] font-semibold disabled:opacity-50"
          >
            {publishMutation.isPending ? t("publishNow.publishing") : t("common.confirm")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
