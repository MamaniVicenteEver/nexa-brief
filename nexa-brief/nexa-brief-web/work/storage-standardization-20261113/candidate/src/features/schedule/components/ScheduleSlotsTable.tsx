"use client";

import { useTranslations } from "next-intl";
import type { ScheduleSlot } from "../types";
import { ScheduleSlotRow } from "./ScheduleSlotRow";

export function ScheduleSlotsTable({ slots }: { slots: ScheduleSlot[] }) {
  const t = useTranslations("schedule");

  if (slots.length === 0) {
    return <div className="py-7.5 text-center text-[13.5px] text-nb-mute">{t("slots.empty")}</div>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {slots.map((slot) => (
        <ScheduleSlotRow key={slot.slotId} slot={slot} />
      ))}
    </div>
  );
}
