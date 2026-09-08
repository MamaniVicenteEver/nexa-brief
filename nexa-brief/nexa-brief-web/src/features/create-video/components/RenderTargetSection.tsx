"use client";

import { useTranslations } from "next-intl";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import type { CreateVideoFormValues } from "../schema";
import type { Niche } from "../types";

/** Solo aparece cuando el motor EFECTIVO es "remotion" — el del nicho, salvo
 * que el usuario lo haya forzado a "playwright" en RecorderEngineSection, en
 * cuyo caso render_target ya no aplica (el backend lo rechazaría). */
export function RenderTargetSection({
  form,
  niches,
}: {
  form: UseFormReturn<CreateVideoFormValues>;
  niches: Niche[] | undefined;
}) {
  const t = useTranslations("createVideo.renderTargetSection");
  const categoryName = useWatch({ control: form.control, name: "categoryName" });
  const renderTarget = useWatch({ control: form.control, name: "renderTarget" }) ?? "local";
  const engineOverride = useWatch({ control: form.control, name: "recorderEngineOverride" });

  const niche = niches?.find((n) => n.id === categoryName);
  const effectiveEngine = engineOverride ?? niche?.recorderEngine;
  if (effectiveEngine !== "remotion") return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13.5px] font-bold tracking-[-0.01em] text-nb-ink">{t("title")}</span>

      <div className="inline-flex w-fit gap-0.5 rounded-full border border-nb-line bg-nb-surface p-0.75">
        {(["local", "aws"] as const).map((target) => (
          <button
            key={target}
            type="button"
            onClick={() => form.setValue("renderTarget", target)}
            className={cn(
              "rounded-full px-4.5 py-2 font-nb-sans text-xs font-semibold text-nb-ink-soft transition-colors",
              renderTarget === target && "bg-nb-ink text-[#fafaf7]",
            )}
          >
            {target === "local" ? t("targetLocal") : t("targetAws")}
          </button>
        ))}
      </div>

      <p className="text-[12.5px] leading-[1.5] text-nb-mute">
        {renderTarget === "local" ? t("hintLocal") : t("hintAws")}
      </p>
    </div>
  );
}
