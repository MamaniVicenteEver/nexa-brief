"use client";

import { useTranslations } from "next-intl";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import { FormControl, FormField, FormItem, FormMessage } from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import type { CreateVideoFormValues } from "../schema";

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function DurationSection({
  form,
  songSeconds,
}: {
  form: UseFormReturn<CreateVideoFormValues>;
  songSeconds: number | null;
}) {
  const t = useTranslations("createVideo.durationSection");
  const durationMode = useWatch({ control: form.control, name: "durationMode" });
  const repeatCount = useWatch({ control: form.control, name: "repeatCount" }) || 1;
  const estimatedSeconds = songSeconds ?? 210;
  const totalAuto = formatDuration(estimatedSeconds * repeatCount);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13.5px] font-bold tracking-[-0.01em] text-nb-ink">{t("title")}</span>

      <div className="inline-flex w-fit gap-0.5 rounded-full border border-nb-line bg-nb-surface p-0.75">
        {(["auto", "manual"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => form.setValue("durationMode", mode)}
            className={cn(
              "rounded-full px-4.5 py-2 font-nb-sans text-xs font-semibold text-nb-ink-soft transition-colors",
              durationMode === mode && "bg-nb-ink text-[#fafaf7]",
            )}
          >
            {mode === "auto" ? t("modeAuto") : t("modeManual")}
          </button>
        ))}
      </div>

      {durationMode === "auto" ? (
        <div className="mt-3.5 rounded-2xl border border-nb-line bg-nb-surface px-4.5 py-4">
          <div className="flex items-center justify-between py-2.25 text-[13px]">
            <span className="text-nb-ink-soft">{t("songDurationLabel")}</span>
            <span className="font-bold text-nb-ink">
              {songSeconds
                ? t("songDurationDetected", { duration: formatDuration(songSeconds) })
                : t("songDurationMissing")}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-nb-line py-2.25 text-[13px]">
            <span className="text-nb-ink-soft">{t("repeatsLabel")}</span>
            <FormField
              control={form.control}
              name="repeatCount"
              render={({ field }) => (
                <FormItem className="gap-0">
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      className="h-auto w-15 rounded-lg px-1.5 py-1.5 text-center"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-nb-line pt-3 text-[13.5px] font-bold text-nb-ink">
            <span>{t("totalEstimated")}</span>
            <span>{totalAuto}</span>
          </div>
        </div>
      ) : (
        <div className="mt-3.5 rounded-2xl border border-nb-line bg-nb-surface px-4.5 py-4">
          <div className="flex items-center justify-between py-2.25 text-[13px]">
            <span className="text-nb-ink-soft">{t("exactDurationLabel")}</span>
            <FormField
              control={form.control}
              name="manualSeconds"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 gap-y-0">
                  <FormControl>
                    <Input
                      type="number"
                      min={5}
                      max={300}
                      className="h-auto w-17.5 rounded-lg px-1.5 py-1.5 text-center"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <span className="text-[13px] font-bold text-nb-ink">{t("secondsUnit")}</span>
                </FormItem>
              )}
            />
          </div>
          <p className="mt-2 text-[12.5px] leading-[1.5] text-nb-mute">{t("manualRangeHint")}</p>
          <FormField control={form.control} name="manualSeconds" render={() => <FormMessage />} />
        </div>
      )}
    </div>
  );
}
