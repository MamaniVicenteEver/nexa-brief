"use client";

import { Trash2 } from "lucide-react";
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
import { useDeletePublishedVideoMutation } from "../hooks/useDeletePublishedVideoMutation";
import type { PublishedVideo } from "../types";
import { dangerButton, dialogContent, secondaryButton } from "./styles";

export function DeletePublishedVideoDialog({
  video,
  open,
  onOpenChange,
}: {
  video: PublishedVideo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("channels.deleteVideo");
  const mutation = useDeletePublishedVideoMutation();
  const platform = PLATFORM_META[video.platform].label;

  const handleConfirm = () => {
    mutation.mutate(
      { platform: video.platform, alias: video.alias, postId: video.postId },
      {
        onSuccess: () => {
          toast.success(t("done", { platform }));
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) mutation.reset();
      }}
    >
      <DialogContent className={cn(dialogContent, "gap-5 sm:max-w-[420px]")}>
        <DialogHeader className="items-start gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-red-500/10">
            <Trash2 className="size-5 text-red-600" />
          </span>
          <DialogTitle className="font-nb-sans text-[18px] font-extrabold tracking-[-0.02em] text-nb-ink">
            {t("title", { platform })}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.55] text-nb-mute">
            {t("body", { title: video.title, platform, alias: video.alias })}
          </DialogDescription>
        </DialogHeader>
        {mutation.isError && (
          <p className="text-[12.5px] text-red-600">
            {mutation.error instanceof Error ? mutation.error.message : t("error")}
          </p>
        )}
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
