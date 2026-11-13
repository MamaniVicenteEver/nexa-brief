"use client";

import { useTranslations } from "next-intl";
import { ResourceScopeProvider } from "@/features/resources/ResourceScope";
import type { TemplateRequirements } from "@/features/templates/types";
import type { MediaRef, StudioValue } from "../types";
import { AiMediaPanel } from "./AiMediaPanel";
import { MediaSlotField } from "./MediaSlotField";
import { SongField } from "./SongField";
import { TextsFields } from "./TextsFields";

export type RequirementsSection = "song" | "media" | "texts";

const BACKGROUND_VISIBILITY_TEMPLATES = new Set([
  "lyrics-impact",
  "lyrics-romantic",
  "lyrics-suave",
  "lyrics-triste",
]);

export interface RequirementsFormProps {
  templateId: string;
  requirements: TemplateRequirements;
  value: StudioValue;
  onChange: (next: StudioValue) => void;
  /** Una sola sección (las pestañas del Estudio). Sin esto se muestran todas
   * apiladas, como en Crear video. */
  section?: RequirementsSection;
  compactSong?: boolean;
}

/** Formulario controlado armado desde GET /templates/{id}/requirements:
 * canción, lugares de medios (librería, subida, stock o IA) y textos. No
 * guarda estado propio: lo usan el Estudio y Crear video. */
export function RequirementsForm({
  templateId,
  requirements,
  value,
  onChange,
  section,
  compactSong = false,
}: RequirementsFormProps) {
  const t = useTranslations("studio.media");
  const show = (s: RequirementsSection) => section === undefined || section === s;
  const hasSong = requirements.audio.required || requirements.audio.lyrics !== "none";

  const setMedia = (slot: string, refs: MediaRef[]) =>
    onChange({ ...value, media: { ...value.media, [slot]: refs } });

  return (
    <ResourceScopeProvider
      scope={{ categoryId: requirements.resourceContext?.categoryId, templateId }}
    >
      <div className="flex flex-col gap-5">
        {show("song") && hasSong && (
          <SongField
            compact={compactSong}
            audio={requirements.audio}
            value={value.musicAssetId}
            onChange={(musicAssetId) => onChange({ ...value, musicAssetId })}
          />
        )}
        {show("song") && !hasSong && section === "song" && (
          <p className="text-[12.5px] text-nb-mute">{t("noSong")}</p>
        )}

        {show("media") &&
          (requirements.media.length === 0 ? (
            section === "media" && <p className="text-[12.5px] text-nb-mute">{t("none")}</p>
          ) : (
            <>
              {requirements.media.map((slot) => (
                <div key={slot.slot} className="flex flex-col gap-3">
                  {slot.slot === "background" &&
                    BACKGROUND_VISIBILITY_TEMPLATES.has(templateId) && (
                      <label className="flex flex-col gap-1 text-[12px] font-semibold text-nb-ink">
                        <span className="flex justify-between">
                          <span>{t("backgroundVisibility")}</span>
                          <span>{Math.round((1 - (value.mediaOpacity?.[slot.slot] ?? 0.8)) * 100)}%</span>
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={Math.round((1 - (value.mediaOpacity?.[slot.slot] ?? 0.8)) * 100)}
                          onChange={(event) =>
                            onChange({
                              ...value,
                              mediaOpacity: {
                                ...value.mediaOpacity,
                                [slot.slot]: 1 - Number(event.target.value) / 100,
                              },
                            })
                          }
                        />
                      </label>
                    )}
                  {slot.slot === "background" && (
                    <AiMediaPanel
                      templateId={templateId}
                      brief={value.brief}
                      onBriefChange={(brief) => onChange({ ...value, brief })}
                      filled={value.media}
                      allowAddingBackground={templateId === "lyrics-impact"}
                      onAccept={(media) => {
                        const background = templateId === "lyrics-impact" && media.background
                          ? [...(value.media.background ?? []), ...media.background].filter(
                              (ref, i, all) => all.findIndex((other) => other.kind === ref.kind && other.assetId === ref.assetId) === i,
                            ).slice(0, slot.max)
                          : media.background;
                        onChange({ ...value, media: { ...value.media, ...media, ...(background ? { background } : {}) } });
                      }}
                    />
                  )}
                  <MediaSlotField
                    slot={slot}
                    value={value.media[slot.slot] ?? []}
                    onChange={(refs) => setMedia(slot.slot, refs)}
                  />
                </div>
              ))}
              {!requirements.media.some((slot) => slot.slot === "background") && <AiMediaPanel
                templateId={templateId}
                brief={value.brief}
                onBriefChange={(brief) => onChange({ ...value, brief })}
                filled={value.media}
                onAccept={(media) => onChange({ ...value, media: { ...value.media, ...media } })}
              />}
            </>
          ))}

        {show("texts") && (requirements.texts.length > 0 || section === "texts") && (
          <TextsFields
            texts={requirements.texts}
            value={value.texts}
            onChange={(texts) => onChange({ ...value, texts })}
          />
        )}
      </div>
    </ResourceScopeProvider>
  );
}
