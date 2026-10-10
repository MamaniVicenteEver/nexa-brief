"use client";

import { ListChecks, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { RequirementsForm } from "@/features/studio";
import type { StudioValue } from "@/features/studio";
import type {
  RequirementMediaSlot,
  Template,
  TemplateRequirements,
} from "@/features/templates/types";
import { cn } from "@/lib/utils";
import { contentFor, unfilledSlots } from "../lib/draft-flow";
import type { CreateVideoFormValues } from "../schema";
import type { ContentMode } from "../hooks/useContentMode";
import { ResourceFields } from "./ResourceFields";

/** Sección "Contenido" del formulario. Con plantilla, sale de sus requisitos
 * (mismo RequirementsForm que el Estudio: canción, medios por lugar con
 * librería/subida/stock/IA, textos y brief); sin plantilla, los dos campos de
 * archivo de siempre. */
export function ContentSection({
  form,
  mode,
  onSongDurationChange,
}: {
  form: UseFormReturn<CreateVideoFormValues>;
  mode: ContentMode;
  onSongDurationChange: (seconds: number | null) => void;
}) {
  const t = useTranslations("createFlow.content");
  const values = useWatch({ control: form.control }) as CreateVideoFormValues;

  if (mode.kind === "loading") {
    return <p className="text-[12.5px] text-nb-mute">{t("loading")}</p>;
  }

  if (mode.kind === "classic") {
    return (
      <div className="flex flex-col gap-2">
        {mode.requirementsFailed && (
          <p className="text-[12px] text-nb-accent-coral">{t("requirementsFailed")}</p>
        )}
        <ResourceFields form={form} onSongDurationChange={onSongDurationChange} />
      </div>
    );
  }

  const { template, requirements } = mode;
  const value = contentFor(values, template.id);

  function onChange(next: StudioValue) {
    form.setValue("content", next, { shouldDirty: true });
    form.setValue("contentTemplateId", template.id, { shouldDirty: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <NeedsCard template={template} requirements={requirements} value={value} />
      <RequirementsForm
        templateId={template.id}
        requirements={requirements}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function slotRange(slot: RequirementMediaSlot) {
  return slot.min === slot.max ? String(slot.max) : `${slot.min}–${slot.max}`;
}

/** Lo que pide la plantilla, de un vistazo (sobre todo en las comerciales,
 * que necesitan varios videos y fotos), y qué pasa con lo que quede vacío. */
function NeedsCard({
  template,
  requirements,
  value,
}: {
  template: Template;
  requirements: TemplateRequirements;
  value: StudioValue;
}) {
  const t = useTranslations("createFlow.needs");
  const hasSong = requirements.audio.required || requirements.audio.lyrics !== "none";
  const ownMedia = requirements.media.some((slot) => slot.target === "media");
  const commercial = template.categoryId === "commercial" || ownMedia;
  const empty = unfilledSlots(requirements, value);
  const hasBrief = value.brief.trim().length > 0;
  const labelOf = (name: string) => requirements.media.find((s) => s.slot === name)?.label || name;

  if (!hasSong && requirements.media.length === 0 && requirements.texts.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-2xl border p-4",
        commercial ? "border-nb-green-dark/30 bg-nb-green/10" : "border-nb-line bg-nb-surface",
      )}
    >
      <div className="flex items-center gap-1.5">
        <ListChecks className="size-4 text-nb-green-dark" />
        <h3 className="text-[13px] font-bold text-nb-ink">
          {commercial ? t("titleCommercial") : t("title")}
        </h3>
      </div>

      <ul className="flex flex-col gap-1 text-[12.5px] text-nb-ink-soft">
        {hasSong && (
          <li>
            {requirements.audio.required ? t("songRequired") : t("songOptional")}
            {requirements.audio.lyrics === "auto" && (
              <span className="text-nb-mute">{` · ${t("lyricsAuto")}`}</span>
            )}
          </li>
        )}
        {requirements.media.map((slot) => {
          const filled = value.media[slot.slot]?.length ?? 0;
          return (
            <li key={slot.slot} className="flex items-baseline justify-between gap-3">
              <span>
                <span className="font-semibold text-nb-ink">{slot.label || slot.slot}</span>
                {": "}
                {t(`kind.${slot.kind === "image|video" ? "any" : slot.kind}`, {
                  range: slotRange(slot),
                  count: slot.max,
                })}
                {slot.orientation && (
                  <span className="text-nb-mute">{` · ${t(`orientation.${slot.orientation}`)}`}</span>
                )}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums",
                  filled >= Math.max(slot.min, 1)
                    ? "bg-nb-green/40 text-nb-green-dark"
                    : "bg-nb-bg-2 text-nb-mute",
                )}
              >
                {t("chosen", { count: filled })}
              </span>
            </li>
          );
        })}
        {requirements.texts.length > 0 && (
          <li>{t("texts", { count: requirements.texts.length })}</li>
        )}
      </ul>

      {requirements.media.length > 0 && (
        <div className="flex gap-2 rounded-xl bg-nb-bg/70 p-2.5 text-[12px] leading-[1.5] text-nb-ink-soft">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-nb-green-dark" />
          <p>
            {empty.length === 0
              ? t("allFilled")
              : hasBrief
                ? t("aiWillFill", { slots: empty.map(labelOf).join(", ") })
                : ownMedia
                  ? t("aiHintCommercial")
                  : t("aiHint")}
          </p>
        </div>
      )}
    </div>
  );
}
