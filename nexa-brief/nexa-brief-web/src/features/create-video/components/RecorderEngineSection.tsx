"use client";

import { useTranslations } from "next-intl";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import type { CreateVideoFormValues } from "../schema";
import type { Niche } from "../types";

/** Solo aparece para nichos con recorderEngine="remotion" (es decir, Remotion
 * es una opción real para ese nicho) — el backend rechaza el override a
 * "remotion" en cualquier otro nicho, así que ahí ni tiene sentido ofrecerlo. */
export function RecorderEngineSection({
  form,
  niches,
}: {
  form: UseFormReturn<CreateVideoFormValues>;
  niches: Niche[] | undefined;
}) {
  const t = useTranslations("createVideo.recorderEngineSection");
  const categoryName = useWatch({ control: form.control, name: "categoryName" });
  const engineOverride =
    useWatch({ control: form.control, name: "recorderEngineOverride" }) ?? "remotion";

  const niche = niches?.find((n) => n.id === categoryName);
  if (niche?.recorderEngine !== "remotion") return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13.5px] font-bold tracking-[-0.01em] text-nb-ink">{t("title")}</span>

      <div className="inline-flex w-fit gap-0.5 rounded-full border border-nb-line bg-nb-surface p-0.75">
        {(["remotion", "playwright"] as const).map((engine) => (
          <button
            key={engine}
            type="button"
            onClick={() =>
              form.setValue("recorderEngineOverride", engine === "remotion" ? undefined : engine)
            }
            className={cn(
              "rounded-full px-4.5 py-2 font-nb-sans text-xs font-semibold text-nb-ink-soft transition-colors",
              engineOverride === engine && "bg-nb-ink text-[#fafaf7]",
            )}
          >
            {engine === "remotion" ? t("engineRemotion") : t("enginePlaywright")}
          </button>
        ))}
      </div>

      <p className="text-[12.5px] leading-[1.5] text-nb-mute">
        {engineOverride === "remotion" ? t("hintRemotion") : t("hintPlaywright")}
      </p>
    </div>
  );
}
