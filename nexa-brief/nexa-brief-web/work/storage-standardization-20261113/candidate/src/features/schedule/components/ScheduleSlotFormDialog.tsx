"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { flattenCategories, useCategories } from "@/features/categories";
import { useChannels } from "@/features/channels/hooks/useChannels";
import { useNiches } from "@/features/create-video/hooks/useNiches";
import { groupNiches } from "@/features/create-video/lib/niche-groups";
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
import { useCreateScheduleSlotMutation } from "../hooks/useCreateScheduleSlotMutation";
import { useUpdateScheduleSlotMutation } from "../hooks/useUpdateScheduleSlotMutation";
import type { ChannelPlatform, ScheduleSlot, Weekday } from "../types";

const PLATFORMS: ChannelPlatform[] = ["youtube", "tiktok", "facebook", "instagram"];

const WEEKDAY_KEY: Record<Weekday, string> = {
  0: "mon",
  1: "tue",
  2: "wed",
  3: "thu",
  4: "fri",
  5: "sat",
  6: "sun",
};

const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS_MON_FRI: Weekday[] = [0, 1, 2, 3, 4];
const WEEKENDS: Weekday[] = [5, 6];

function sameDays(a: Weekday[], b: Weekday[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((day, i) => day === sortedB[i]);
}

export function ScheduleSlotFormDialog({
  mode,
  slot,
  children,
}: {
  mode: "create" | "edit";
  slot?: ScheduleSlot;
  children: React.ReactNode;
}) {
  const t = useTranslations("schedule");
  const [open, setOpen] = useState(false);
  const { data: channels } = useChannels();
  const { data: niches } = useNiches();
  const nicheGroups = groupNiches(niches ?? []);
  const { data: categoryTree } = useCategories();
  const categoryOptions = flattenCategories(categoryTree ?? []);
  const createMutation = useCreateScheduleSlotMutation();
  const updateMutation = useUpdateScheduleSlotMutation();

  const [platform, setPlatform] = useState<ChannelPlatform>(slot?.platform ?? "youtube");
  const [accountAlias, setAccountAlias] = useState(slot?.accountAlias ?? "");
  const [days, setDays] = useState<Weekday[]>(slot?.days ?? []);
  const nextTimeId = useRef(0);
  const makeTimeEntries = (values: string[]) =>
    values.map((value) => ({ id: `t${nextTimeId.current++}`, value }));
  const [timeEntries, setTimeEntries] = useState(() => makeTimeEntries(slot?.times ?? ["09:00"]));
  const [nicheFilter, setNicheFilter] = useState(slot?.nicheFilter ?? "");

  const mutation = mode === "create" ? createMutation : updateMutation;
  const accountsForPlatform = (channels ?? []).filter((c) => c.platform === platform);
  const times = timeEntries.map((entry) => entry.value);

  const toggleDay = (day: Weekday) => {
    setDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    );
  };

  const updateTime = (id: string, value: string) => {
    setTimeEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, value } : entry)),
    );
  };

  const removeTime = (id: string) => {
    setTimeEntries((current) => current.filter((entry) => entry.id !== id));
  };

  const addTime = () => {
    setTimeEntries((current) => [...current, ...makeTimeEntries(["09:00"])]);
  };

  const resetForm = () => {
    setPlatform(slot?.platform ?? "youtube");
    setAccountAlias(slot?.accountAlias ?? "");
    setDays(slot?.days ?? []);
    setTimeEntries(makeTimeEntries(slot?.times ?? ["09:00"]));
    setNicheFilter(slot?.nicheFilter ?? "");
  };

  const isValid = accountAlias.trim() !== "" && days.length > 0 && times.length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    const input = {
      platform,
      accountAlias: accountAlias.trim(),
      days,
      times,
      nicheFilter: nicheFilter || null,
    };
    if (mode === "create") {
      createMutation.mutate(input, { onSuccess: () => setOpen(false) });
    } else if (slot) {
      updateMutation.mutate({ slotId: slot.slotId, input }, { onSuccess: () => setOpen(false) });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetForm();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-nb-ink">
            {mode === "create" ? t("slotForm.createTitle") : t("slotForm.editTitle")}
          </DialogTitle>
          <DialogDescription className="text-nb-mute">
            {t("slotForm.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="slotPlatform"
                className="text-[11px] font-semibold text-nb-mute uppercase"
              >
                {t("slotForm.platformLabel")}
              </label>
              <select
                id="slotPlatform"
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
              <label
                htmlFor="slotAccount"
                className="text-[11px] font-semibold text-nb-mute uppercase"
              >
                {t("slotForm.accountLabel")}
              </label>
              <select
                id="slotAccount"
                value={accountAlias}
                onChange={(e) => setAccountAlias(e.target.value)}
                className="rounded-xl border border-nb-line bg-transparent px-3 py-2 text-[13px] text-nb-ink outline-none focus:border-nb-ink"
              >
                <option value="">{t("slotForm.chooseAccount")}</option>
                {accountsForPlatform.map((account) => (
                  <option key={account.alias} value={account.alias}>
                    {account.name} ({account.alias})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-nb-mute uppercase">
              {t("slotForm.daysLabel")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ALL_WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "rounded-full border border-nb-line px-3 py-1.5 text-[12px] font-semibold text-nb-ink-soft",
                    days.includes(day) && "border-nb-ink bg-nb-ink text-[#fafaf7]",
                  )}
                >
                  {t(`weekdays.${WEEKDAY_KEY[day]}`)}
                </button>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDays(ALL_WEEKDAYS)}
                className={cn(
                  "text-[11.5px] font-semibold text-nb-mute underline-offset-2 hover:underline",
                  sameDays(days, ALL_WEEKDAYS) && "text-nb-ink",
                )}
              >
                {t("slotForm.presetAllDays")}
              </button>
              <button
                type="button"
                onClick={() => setDays(WEEKDAYS_MON_FRI)}
                className={cn(
                  "text-[11.5px] font-semibold text-nb-mute underline-offset-2 hover:underline",
                  sameDays(days, WEEKDAYS_MON_FRI) && "text-nb-ink",
                )}
              >
                {t("slotForm.presetWeekdays")}
              </button>
              <button
                type="button"
                onClick={() => setDays(WEEKENDS)}
                className={cn(
                  "text-[11.5px] font-semibold text-nb-mute underline-offset-2 hover:underline",
                  sameDays(days, WEEKENDS) && "text-nb-ink",
                )}
              >
                {t("slotForm.presetWeekends")}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-nb-mute uppercase">
              {t("slotForm.timesLabel")}
            </span>
            <div className="flex flex-col gap-2">
              {timeEntries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={entry.value}
                    onChange={(e) => updateTime(entry.id, e.target.value)}
                    className="rounded-xl border border-nb-line bg-transparent px-3 py-1.5 text-[13px] text-nb-ink outline-none focus:border-nb-ink"
                  />
                  {timeEntries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTime(entry.id)}
                      className="text-[12px] font-semibold text-red-600 underline-offset-2 hover:underline"
                    >
                      {t("slotForm.removeTime")}
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addTime}
                className="w-fit text-[12px] font-semibold text-nb-ink underline-offset-2 hover:underline"
              >
                {t("slotForm.addTime")}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="slotNiche" className="text-[11px] font-semibold text-nb-mute uppercase">
              {t("slotForm.nicheLabel")}
            </label>
            <select
              id="slotNiche"
              value={nicheFilter}
              onChange={(e) => setNicheFilter(e.target.value)}
              className="rounded-xl border border-nb-line bg-transparent px-3 py-2 text-[13px] text-nb-ink outline-none focus:border-nb-ink"
            >
              <option value="">{t("slotForm.anyNiche")}</option>
              {categoryOptions.length > 0 && (
                <optgroup label={t("slotForm.categoriesGroup")}>
                  {categoryOptions.map((category) => (
                    <option key={category.path} value={category.path}>
                      {category.status === "active"
                        ? category.label
                        : `${category.label} (${t(`slotForm.categoryStatus.${category.status}`)})`}
                    </option>
                  ))}
                </optgroup>
              )}
              {nicheGroups.map((group) => (
                <optgroup key={group.id} label={group.name}>
                  {group.niches.map((niche) => (
                    <option key={niche.id} value={niche.id}>
                      {niche.displayName}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {mutation.isError && (
          <p className="text-[12.5px] text-red-600">{t("slotForm.saveError")}</p>
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
            disabled={!isValid || mutation.isPending}
            onClick={handleSubmit}
            className="nb-btn-pill px-4 py-2 text-[12.5px] font-semibold disabled:opacity-50"
          >
            {mutation.isPending ? t("common.saving") : t("common.save")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
