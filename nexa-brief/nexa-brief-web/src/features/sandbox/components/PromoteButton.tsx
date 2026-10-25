"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { usePromoteSandboxItem } from "../hooks/usePromoteSandboxItem";
import type { SandboxItem } from "../types";

export function PromoteButton({ item, folderLabel }: { item: SandboxItem; folderLabel: string }) {
  const t = useTranslations("sandbox");
  const [open, setOpen] = useState(false);
  const promoteMutation = usePromoteSandboxItem();
  const blocker = item.promoteBlocker ?? t("promotionUnavailable");
  const disabled = !item.promotable || promoteMutation.isPending;

  function confirmPromotion() {
    promoteMutation.mutate(
      { folder: item.folder, id: item.id },
      {
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : t("promoteError"));
        },
      },
    );
  }

  return (
    <>
      <div className="border-t border-nb-line/70 px-3 py-2">
        <button
          type="button"
          disabled={disabled}
          aria-busy={promoteMutation.isPending}
          title={!item.promotable ? blocker : undefined}
          onClick={() => setOpen(true)}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-nb-line px-3 py-1.5 text-xs font-semibold text-nb-ink transition-colors hover:border-nb-ink disabled:cursor-not-allowed disabled:text-nb-mute disabled:opacity-70"
        >
          {promoteMutation.isPending && <LoaderCircle className="size-3.5 animate-spin" />}
          {promoteMutation.isPending ? t("promoteLoading") : t("promote")}
        </button>
        {!item.promotable && (
          <p className="mt-1 text-center text-[10px] leading-4 text-nb-mute">{blocker}</p>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!promoteMutation.isPending) setOpen(nextOpen);
        }}
      >
        <DialogContent className="gap-5 rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-nb-ink">{t("promoteConfirmTitle")}</DialogTitle>
            <DialogDescription className="text-nb-mute">
              {t("promoteConfirmDescription", { folderLabel })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 bg-transparent">
            <button
              type="button"
              disabled={promoteMutation.isPending}
              onClick={() => setOpen(false)}
              className="rounded-full border border-nb-line px-4 py-2 text-sm font-semibold text-nb-ink-soft hover:border-nb-ink disabled:opacity-50"
            >
              {t("promoteCancel")}
            </button>
            <button
              type="button"
              disabled={promoteMutation.isPending}
              onClick={confirmPromotion}
              className="rounded-full bg-nb-ink px-4 py-2 text-sm font-semibold text-white hover:bg-nb-ink/85 disabled:cursor-wait disabled:opacity-60"
            >
              {promoteMutation.isPending ? t("promoteLoading") : t("promoteConfirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
