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
import { useDeleteScheduleSlotMutation } from "../hooks/useDeleteScheduleSlotMutation";
import { useUpdateScheduleSlotMutation } from "../hooks/useUpdateScheduleSlotMutation";
import type { ScheduleSlot, Weekday } from "../types";
import { AssignVideoDialog } from "./AssignVideoDialog";
import { ScheduleSlotFormDialog } from "./ScheduleSlotFormDialog";

const WEEKDAY_KEY: Record<Weekday, string> = {
  0: "mon",
  1: "tue",
  2: "wed",
  3: "thu",
  4: "fri",
  5: "sat",
  6: "sun",
};

export function ScheduleSlotRow({ slot }: { slot: ScheduleSlot }) {
  const t = useTranslations("schedule");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteMutation = useDeleteScheduleSlotMutation();
  const toggleMutation = useUpdateScheduleSlotMutation();

  const platformLabel = t(`platforms.${slot.platform}`);

  const formatDays = (days: Weekday[]): string =>
    [...days]
      .sort()
      .map((d) => t(`weekdays.${WEEKDAY_KEY[d]}`))
      .join(", ");

  const handleDelete = () => {
    deleteMutation.mutate(slot.slotId, { onSuccess: () => setConfirmOpen(false) });
  };

  const handleToggleEnabled = () => {
    toggleMutation.mutate({ slotId: slot.slotId, input: { enabled: !slot.enabled } });
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-nb-surface px-4 py-3.5 shadow-[0_10px_22px_-14px_rgba(40,30,10,0.2)] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-nb-ink">{platformLabel}</span>
          <span className="text-xs text-nb-mute">· {slot.accountAlias}</span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              slot.enabled ? "bg-nb-green/15 text-nb-green-dark" : "bg-nb-bg-2 text-nb-mute",
            )}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                slot.enabled ? "bg-nb-green-dark" : "bg-nb-mute",
              )}
            />
            {slot.enabled ? t("slots.enabled") : t("slots.disabled")}
          </span>
        </div>
        <div className="mt-1 text-xs text-nb-mute">
          {formatDays(slot.days)} · {slot.times.join(", ")}
          {slot.nicheFilter && ` · ${t("slots.nicheFilterLabel", { niche: slot.nicheFilter })}`}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <AssignVideoDialog slot={slot}>
          <button
            type="button"
            className="text-[12px] font-semibold text-nb-ink underline-offset-2 hover:underline"
          >
            {t("slots.assignVideo")}
          </button>
        </AssignVideoDialog>

        <ScheduleSlotFormDialog mode="edit" slot={slot}>
          <button
            type="button"
            className="text-[12px] font-semibold text-nb-ink-soft underline-offset-2 hover:underline"
          >
            {t("slots.edit")}
          </button>
        </ScheduleSlotFormDialog>

        <button
          type="button"
          disabled={toggleMutation.isPending}
          onClick={handleToggleEnabled}
          className="text-[12px] font-semibold text-nb-ink-soft underline-offset-2 hover:underline disabled:opacity-50"
        >
          {slot.enabled ? t("slots.pause") : t("slots.activate")}
        </button>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="text-[12px] font-semibold text-red-600 underline-offset-2 hover:underline"
            >
              {t("slots.delete")}
            </button>
          </DialogTrigger>
          <DialogContent className="rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-95">
            <DialogHeader>
              <DialogTitle className="text-nb-ink">{t("slots.deleteConfirmTitle")}</DialogTitle>
              <DialogDescription className="text-nb-mute">
                {t("slots.deleteConfirmDescription", {
                  platform: platformLabel,
                  account: slot.accountAlias,
                  days: formatDays(slot.days),
                  times: slot.times.join(", "),
                })}
              </DialogDescription>
            </DialogHeader>
            {deleteMutation.isError && (
              <p className="text-[12.5px] text-red-600">{t("slots.deleteError")}</p>
            )}
            <DialogFooter className="bg-transparent">
              <DialogClose asChild>
                <button
                  type="button"
                  className="rounded-full border border-nb-line px-4 py-2 text-[12.5px] font-semibold text-nb-ink"
                >
                  {t("common.cancel")}
                </button>
              </DialogClose>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={handleDelete}
                className="rounded-full bg-red-600 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
              >
                {deleteMutation.isPending ? t("slots.deleting") : t("slots.confirmDelete")}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
