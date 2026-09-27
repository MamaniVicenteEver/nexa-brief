"use client";

import { useTranslations } from "next-intl";
import { useScheduleSlots } from "../hooks/useScheduleSlots";
import { ScheduleSlotFormDialog } from "./ScheduleSlotFormDialog";
import { ScheduleSlotsTable } from "./ScheduleSlotsTable";

export function ScheduleSlotsSection() {
  const t = useTranslations("schedule");
  const { data: slots, isLoading, isError, isFetching } = useScheduleSlots();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[12.5px] text-nb-mute">{t("slots.description")}</p>
        <div className="flex shrink-0 items-center gap-3">
          {isFetching && !isLoading && (
            <span className="text-[11.5px] text-nb-mute">{t("common.updating")}</span>
          )}
          <ScheduleSlotFormDialog mode="create">
            <button type="button" className="nb-btn-pill px-4 py-2 text-[12.5px] font-semibold">
              {t("slots.newSlot")}
            </button>
          </ScheduleSlotFormDialog>
        </div>
      </div>

      {isError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] font-medium text-red-600">
          {t("slots.loadError")}
        </div>
      )}

      {isLoading ? (
        <p className="text-[13px] text-nb-mute">{t("slots.loading")}</p>
      ) : (
        <ScheduleSlotsTable slots={slots ?? []} />
      )}
    </div>
  );
}
