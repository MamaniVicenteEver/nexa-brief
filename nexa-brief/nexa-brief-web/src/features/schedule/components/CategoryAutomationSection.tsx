"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { usePublishAccounts } from "@/features/explainer";
import { cn } from "@/lib/utils";
import {
  useCategoryAutomations,
  useSaveCategoryAutomationMutation,
} from "../hooks/useCategoryAutomations";
import type { CategoryAutomation, CategoryCadence, Weekday } from "../types";

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
const CADENCES: CategoryCadence[] = ["daily", "alternate", "custom"];
const FIELD_LABEL = "text-[11px] font-semibold text-nb-mute uppercase";

/** Valores iniciales del formulario a partir de los horarios que ya tiene la categoría. */
function initialForm(automation: CategoryAutomation) {
  const slots = automation.slots;
  const days = [...new Set(slots.flatMap((s) => s.days))].sort() as Weekday[];
  const times = [...new Set(slots.flatMap((s) => s.times))].sort();
  const cadence: CategoryCadence =
    slots.length === 0 ? automation.defaultCadence : days.length === 7 ? "daily" : "custom";
  return {
    accounts: slots.map((s) => `${s.platform}:${s.accountAlias}`),
    cadence,
    days: days.length > 0 ? days : ALL_WEEKDAYS,
    times: times.length > 0 ? times : ["15:00"],
  };
}

function AutomationCard({ automation }: { automation: CategoryAutomation }) {
  const t = useTranslations("schedule");
  const { data: accounts = [] } = usePublishAccounts();
  const mutation = useSaveCategoryAutomationMutation();
  const [editing, setEditing] = useState(false);
  const initial = initialForm(automation);
  const [selected, setSelected] = useState<string[]>(initial.accounts);
  const [cadence, setCadence] = useState<CategoryCadence>(initial.cadence);
  const [days, setDays] = useState<Weekday[]>(initial.days);
  const nextTimeId = useRef(0);
  const makeTimes = (values: string[]) =>
    values.map((value) => ({ id: `t${nextTimeId.current++}`, value }));
  const [times, setTimes] = useState(() => makeTimes(initial.times));

  const dayLabel = (list: Weekday[]) =>
    list.length === 7
      ? t("slotForm.presetAllDays")
      : list.map((d) => t(`weekdays.${WEEKDAY_KEY[d]}`)).join(" ");

  const resetForm = () => {
    const next = initialForm(automation);
    setSelected(next.accounts);
    setCadence(next.cadence);
    setDays(next.days);
    setTimes(makeTimes(next.times));
  };

  const toggleAccount = (selector: string) =>
    setSelected((current) =>
      current.includes(selector) ? current.filter((s) => s !== selector) : [...current, selector],
    );
  const toggleDay = (day: Weekday) =>
    setDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    );

  const timeValues = times.map((entry) => entry.value).filter(Boolean);
  const isValid =
    selected.length > 0 && timeValues.length > 0 && (cadence !== "custom" || days.length > 0);

  const handleSave = () => {
    if (!isValid) return;
    mutation.mutate(
      {
        categoryPath: automation.categoryId,
        accounts: selected,
        cadence,
        days: cadence === "custom" ? days : undefined,
        times: timeValues,
      },
      {
        onSuccess: (slots) => {
          toast.success(t("automation.saved", { count: slots.length }));
          setEditing(false);
        },
      },
    );
  };

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-nb-line bg-nb-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-nb-ink">{automation.displayName}</h3>
            {automation.status !== "active" && (
              <span className="rounded-full bg-nb-bg-2 px-2 py-0.5 text-[10px] font-bold text-nb-mute uppercase">
                {t(`slotForm.categoryStatus.${automation.status}`)}
              </span>
            )}
          </div>
          <p className="text-[12px] text-nb-mute">
            {t(`automation.engine.${automation.engine}`)} ·{" "}
            {t(`automation.cadence.${automation.defaultCadence}`)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!editing) resetForm();
            setEditing((v) => !v);
          }}
          className="rounded-full border border-nb-line px-3.5 py-1.5 text-[12px] font-semibold text-nb-ink hover:border-nb-ink"
        >
          {editing ? t("common.close") : t("automation.configure")}
        </button>
      </div>

      {automation.slots.length === 0 ? (
        <p className="text-[12.5px] text-nb-mute">{t("automation.noSlots")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {automation.slots.map((slot) => (
            <li key={slot.slotId} className="text-[12.5px] text-nb-ink-soft">
              <span className="font-semibold text-nb-ink">
                {t(`platforms.${slot.platform}`)} · {slot.accountAlias}
              </span>{" "}
              — {dayLabel(slot.days)} · {slot.times.join(", ")} UTC
              {!slot.enabled && <span className="text-nb-mute"> ({t("slots.disabled")})</span>}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="flex flex-col gap-3.5 border-t border-nb-line pt-3.5">
          <fieldset className="flex flex-col gap-1.5">
            <legend className={cn(FIELD_LABEL, "mb-1.5")}>{t("automation.channels")}</legend>
            {accounts.length === 0 && (
              <p className="text-[12px] text-nb-mute">{t("automation.noAccounts")}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {accounts.map((account) => (
                <label
                  key={account.selector}
                  className="flex items-center gap-1.5 text-[12.5px] text-nb-ink"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(account.selector)}
                    onChange={() => toggleAccount(account.selector)}
                  />
                  {account.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>{t("automation.cadenceLabel")}</span>
            <div className="flex flex-wrap gap-1.5">
              {CADENCES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={cadence === option}
                  onClick={() => setCadence(option)}
                  className={cn(
                    "rounded-full border border-nb-line px-3 py-1.5 text-[12px] font-semibold text-nb-ink-soft",
                    cadence === option && "border-nb-ink bg-nb-ink text-[#fafaf7]",
                  )}
                >
                  {t(`automation.cadence.${option}`)}
                </button>
              ))}
            </div>
            {cadence === "custom" && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {ALL_WEEKDAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={days.includes(day)}
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
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>{t("slotForm.timesLabel")}</span>
            <div className="flex flex-wrap items-center gap-2">
              {times.map((entry) => (
                <div key={entry.id} className="flex items-center gap-1.5">
                  <input
                    type="time"
                    aria-label={t("slotForm.timesLabel")}
                    value={entry.value}
                    onChange={(e) =>
                      setTimes((current) =>
                        current.map((x) =>
                          x.id === entry.id ? { ...x, value: e.target.value } : x,
                        ),
                      )
                    }
                    className="rounded-xl border border-nb-line bg-transparent px-3 py-1.5 text-[13px] text-nb-ink outline-none focus:border-nb-ink"
                  />
                  {times.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setTimes((current) => current.filter((x) => x.id !== entry.id))
                      }
                      className="text-[12px] font-semibold text-red-600 underline-offset-2 hover:underline"
                    >
                      {t("slotForm.removeTime")}
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setTimes((current) => [...current, ...makeTimes(["15:00"])])}
                className="text-[12px] font-semibold text-nb-ink underline-offset-2 hover:underline"
              >
                {t("slotForm.addTime")}
              </button>
            </div>
            <p className="text-[11.5px] text-nb-mute">{t("automation.utcNote")}</p>
          </div>

          {mutation.isError && (
            <p className="text-[12.5px] text-red-600">{t("slotForm.saveError")}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <p className="mr-auto text-[11.5px] text-nb-mute">{t("automation.replaceNote")}</p>
            <button
              type="button"
              disabled={!isValid || mutation.isPending}
              onClick={handleSave}
              className="nb-btn-pill px-4 py-2 text-[12.5px] font-semibold disabled:opacity-50"
            >
              {mutation.isPending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** "Automatización por categoría": cada categoría publica sola en sus canales. */
export function CategoryAutomationSection() {
  const t = useTranslations("schedule");
  const { data: automations = [], isLoading, isError } = useCategoryAutomations();

  return (
    <section aria-labelledby="category-automation-heading" className="flex flex-col gap-3">
      <div>
        <h2
          id="category-automation-heading"
          className="font-nb-sans text-[18px] font-extrabold tracking-[-0.02em] text-nb-ink"
        >
          {t("automation.heading")}
        </h2>
        <p className="text-[12.5px] text-nb-mute">{t("automation.description")}</p>
      </div>
      {isLoading && <p className="text-[13px] text-nb-mute">{t("automation.loading")}</p>}
      {isError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] font-medium text-red-600">
          {t("automation.loadError")}
        </div>
      )}
      <ul className="grid gap-3 md:grid-cols-2">
        {automations.map((automation) => (
          <AutomationCard key={automation.categoryId} automation={automation} />
        ))}
      </ul>
    </section>
  );
}
