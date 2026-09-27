"use client";

import { Unplug } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { PLATFORM_META } from "../constants/platforms";
import { useDisconnectChannelMutation } from "../hooks/useDisconnectChannelMutation";
import type { ChannelAccount } from "../types";
import { dangerButton, dialogContent, secondaryButton } from "./styles";

export function DisconnectAccountDialog({
  account,
  open,
  onOpenChange,
}: {
  account: ChannelAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("channels.disconnect");
  const mutation = useDisconnectChannelMutation();

  const handleConfirm = () => {
    mutation.mutate(
      { platform: account.platform, alias: account.alias },
      {
        onSuccess: () => {
          toast.success(t("done", { name: account.name }));
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogContent, "gap-5 sm:max-w-[420px]")}>
        <DialogHeader className="items-start gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-red-500/10">
            <Unplug className="size-5 text-red-600" />
          </span>
          <DialogTitle className="font-nb-sans text-[18px] font-extrabold tracking-[-0.02em] text-nb-ink">
            {t("title", { name: account.name })}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.55] text-nb-mute">
            {t("body", { platform: PLATFORM_META[account.platform].label, alias: account.alias })}
          </DialogDescription>
        </DialogHeader>
        {mutation.isError && <p className="text-[12.5px] text-red-600">{t("error")}</p>}
        <DialogFooter className="flex-row justify-end gap-2 bg-transparent">
          <button type="button" className={secondaryButton} onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className={dangerButton}
            disabled={mutation.isPending}
            onClick={handleConfirm}
          >
            {mutation.isPending ? t("pending") : t("confirm")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
