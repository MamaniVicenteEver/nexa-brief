"use client";

import { useTranslations } from "next-intl";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import type { CreateVideoFormValues } from "../schema";
import type { Niche } from "../types";

const ENGINE_ORDER = ["remotion", "hyperframes", "playwright"] as const;
type Engine = (typeof ENGINE_ORDER)[number];

const ENGINE_LABEL_KEY: Record<Engine, "engineRemotion" | "engineHyperframes" | "enginePlaywright"> = {
  remotion: "engineRemotion",
  hyperframes: "engineHyperframes",
  playwright: "enginePlaywright",
};
const ENGINE_HINT_KEY: Record<Engine, "hintRemotion" | "hintHyperframes" | "hintPlaywright"> = {
  remotion: "hintRemotion",
  hyperframes: "hintHyperframes",
  playwright: "hintPlaywright",
};

/** Solo aparece si el niche tiene más de un motor soportado (Niche.supportedEngines,
 * ver niches-service.ts) — "playwright" es universal y siempre está, pero un
 * solo motor disponible no amerita selector. El backend rechaza con 400
 * cualquier override a un motor sin composición portada para ese niche, así
 * que acá solo se ofrecen los que supported_engines ya confirmó como válidos. */
export function RecorderEngineSection({
  form,
  niches,
}: {
  form: UseFormReturn<CreateVideoFormValues>;
  niches: Niche[] | undefined;
}) {
  const t = useTranslations("createVideo.recorderEngineSection");
  const categoryName = useWatch({ control: form.control, name: "categoryName" });
  const recorderEngineOverride = useWatch({ control: form.control, name: "recorderEngineOverride" });

  const niche = niches?.find((n) => n.id === categoryName);
  const supported = niche?.supportedEngines ?? [];
  if (supported.length < 2) return null;

  const defaultEngine = (niche?.recorderEngine as Engine) ?? "playwright";
  const engineOverride = recorderEngineOverride ?? defaultEngine;
  const engines = ENGINE_ORDER.filter((engine) => supported.includes(engine));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13.5px] font-bold tracking-[-0.01em] text-nb-ink">{t("title")}</span>

      <div className="inline-flex w-fit gap-0.5 rounded-full border border-nb-line bg-nb-surface p-0.75">
        {engines.map((engine) => (
          <button
            key={engine}
            type="button"
            onClick={() =>
              form.setValue("recorderEngineOverride", engine === defaultEngine ? undefined : engine)
            }
            className={cn(
              "rounded-full px-4.5 py-2 font-nb-sans text-xs font-semibold text-nb-ink-soft transition-colors",
              engineOverride === engine && "bg-nb-ink text-[#fafaf7]",
            )}
          >
            {t(ENGINE_LABEL_KEY[engine])}
          </button>
        ))}
      </div>

      <p className="text-[12.5px] leading-[1.5] text-nb-mute">{t(ENGINE_HINT_KEY[engineOverride as Engine])}</p>
    </div>
  );
}
