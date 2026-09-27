"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
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
import { LABEL_MAX_LENGTH, NOTES_MAX_LENGTH } from "../constants/platforms";
import { useUpdateChannelMutation } from "../hooks/useUpdateChannelMutation";
import type { ChannelAccount } from "../types";
import { dialogContent, fieldInput, primaryButton, secondaryButton } from "./styles";

export function EditAccountDialog({
  account,
  open,
  onOpenChange,
}: {
  account: ChannelAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogContent, "gap-5 sm:max-w-[460px]")}>
        <EditAccountForm account={account} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Mounted only while the dialog is open, so its local state starts fresh from `account` each time. */
function EditAccountForm({ account, onClose }: { account: ChannelAccount; onClose: () => void }) {
  const t = useTranslations("channels.edit");
  const mutation = useUpdateChannelMutation();
  const [label, setLabel] = useState(account.label);
  const [notes, setNotes] = useState(account.notes);

  const dirty = label.trim() !== account.label || notes.trim() !== account.notes;

  const handleSave = () => {
    mutation.mutate(
      {
        platform: account.platform,
        alias: account.alias,
        update: { label: label.trim(), notes: notes.trim() },
      },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          onClose();
        },
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-nb-sans text-[18px] font-extrabold tracking-[-0.02em] text-nb-ink">
          {t("title")}
        </DialogTitle>
        <DialogDescription className="text-[13px] text-nb-mute">
          {t("description", { name: account.name })}
        </DialogDescription>
      </DialogHeader>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-semibold text-nb-ink">{t("labelLabel")}</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("labelPlaceholder")}
          maxLength={LABEL_MAX_LENGTH}
          className={fieldInput}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between text-[12.5px] font-semibold text-nb-ink">
          {t("notesLabel")}
          <span className="text-[11px] font-normal text-nb-mute">
            {notes.length}/{NOTES_MAX_LENGTH}
          </span>
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("notesPlaceholder")}
          maxLength={NOTES_MAX_LENGTH}
          rows={4}
          className={cn(fieldInput, "resize-none leading-[1.5]")}
        />
      </label>

      {mutation.isError && <p className="text-[12.5px] text-red-600">{t("error")}</p>}

      <DialogFooter className="flex-row justify-end gap-2 bg-transparent">
        <button type="button" className={secondaryButton} onClick={onClose}>
          {t("cancel")}
        </button>
        <button
          type="button"
          className={primaryButton}
          disabled={!dirty || mutation.isPending}
          onClick={handleSave}
        >
          {mutation.isPending ? t("saving") : t("save")}
        </button>
      </DialogFooter>
    </>
  );
}
