"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useJobs } from "@/features/library";
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
import { useAssignVideoMutation } from "../hooks/useAssignVideoMutation";
import type { ScheduleSlot, Weekday } from "../types";

const AUTO_VALUE = "__auto__";

interface Occurrence {
  date: string; // "YYYY-MM-DD"
  time: string;
  label: string;
}

function toOurWeekday(date: Date): Weekday {
  // Date#getDay(): 0=domingo..6=sábado → nuestro Weekday: 0=lunes..6=domingo
  return ((date.getUTCDay() + 6) % 7) as Weekday;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function computeNextOccurrences(slot: ScheduleSlot, horizonDays = 14, limit = 20): Occurrence[] {
  const occurrences: Occurrence[] = [];
  const today = new Date();
  for (let offset = 0; offset < horizonDays; offset += 1) {
    const date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset),
    );
    if (!slot.days.includes(toOurWeekday(date))) continue;
    const dateKey = toDateKey(date);
    for (const time of slot.times) {
      occurrences.push({
        date: dateKey,
        time,
        label: `${date.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "2-digit" })} · ${time}`,
      });
    }
  }
  return occurrences.slice(0, limit);
}

export function AssignVideoDialog({
  slot,
  children,
}: {
  slot: ScheduleSlot;
  children: React.ReactNode;
}) {
  const t = useTranslations("schedule");
  const [open, setOpen] = useState(false);
  const { data: jobs } = useJobs();
  const assignMutation = useAssignVideoMutation();

  const occurrences = useMemo(() => computeNextOccurrences(slot), [slot]);
  const [occurrenceIndex, setOccurrenceIndex] = useState(0);
  const [jobId, setJobId] = useState(AUTO_VALUE);

  const readyJobs = (jobs ?? []).filter((job) => job.stage === "packaged");
  const selectedOccurrence = occurrences[occurrenceIndex];

  const handleSubmit = () => {
    if (!selectedOccurrence) return;
    assignMutation.mutate(
      {
        slotId: slot.slotId,
        input: {
          occurrenceDate: selectedOccurrence.date,
          time: selectedOccurrence.time,
          jobId: jobId === AUTO_VALUE ? null : jobId,
        },
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setOccurrenceIndex(0);
          setJobId(AUTO_VALUE);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="rounded-nb-sm bg-nb-surface text-nb-ink ring-nb-line sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-nb-ink">{t("assignVideo.title")}</DialogTitle>
          <DialogDescription className="text-nb-mute">
            {t("assignVideo.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="occurrence"
              className="text-[11px] font-semibold text-nb-mute uppercase"
            >
              {t("assignVideo.occurrenceLabel")}
            </label>
            {occurrences.length > 0 ? (
              <select
                id="occurrence"
                value={occurrenceIndex}
                onChange={(e) => setOccurrenceIndex(Number(e.target.value))}
                className="rounded-xl border border-nb-line bg-transparent px-3 py-2 text-[13px] text-nb-ink outline-none focus:border-nb-ink"
              >
                {occurrences.map((occurrence, index) => (
                  <option key={`${occurrence.date}-${occurrence.time}`} value={index}>
                    {occurrence.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-[12.5px] text-nb-mute">{t("assignVideo.noOccurrences")}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="assignJob" className="text-[11px] font-semibold text-nb-mute uppercase">
              {t("assignVideo.videoLabel")}
            </label>
            <select
              id="assignJob"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="rounded-xl border border-nb-line bg-transparent px-3 py-2 text-[13px] text-nb-ink outline-none focus:border-nb-ink"
            >
              <option value={AUTO_VALUE}>{t("assignVideo.auto")}</option>
              {readyJobs.map((job) => (
                <option key={job.jobId} value={job.jobId}>
                  {job.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {assignMutation.isError && (
          <p className="text-[12.5px] text-red-600">{t("assignVideo.saveError")}</p>
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
            disabled={!selectedOccurrence || assignMutation.isPending}
            onClick={handleSubmit}
            className="nb-btn-pill px-4 py-2 text-[12.5px] font-semibold disabled:opacity-50"
          >
            {assignMutation.isPending ? t("common.saving") : t("common.confirm")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
