"use client";

import { useTranslations } from "next-intl";
import type { TemplateRequirements } from "@/features/templates/types";
import type { MediaRef, StudioValue } from "../types";
import { AiMediaPanel } from "./AiMediaPanel";
import { MediaSlotField } from "./MediaSlotField";
import { SongField } from "./SongField";
import { TextsFields } from "./TextsFields";

export type RequirementsSection = "song" | "media" | "texts";

export interface RequirementsFormProps {
  templateId: string;
  requirements: TemplateRequirements;
  value: StudioValue;
  onChange: (next: StudioValue) => void;
  /** Una sola sección (las pestañas del Estudio). Sin esto se muestran todas
   * apiladas, como en Crear video. */
  section?: RequirementsSection;
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
}: RequirementsFormProps) {
  const t = useTranslations("studio.media");
  const show = (s: RequirementsSection) => section === undefined || section === s;
  const hasSong = requirements.audio.required || requirements.audio.lyrics !== "none";

  const setMedia = (slot: string, refs: MediaRef[]) =>
    onChange({ ...value, media: { ...value.media, [slot]: refs } });

  return (
    <div className="flex flex-col gap-5">
      {show("song") && hasSong && (
        <SongField
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
            <AiMediaPanel
              templateId={templateId}
              brief={value.brief}
              onBriefChange={(brief) => onChange({ ...value, brief })}
              filled={value.media}
              onAccept={(media) => onChange({ ...value, media: { ...value.media, ...media } })}
            />
            {requirements.media.map((slot) => (
              <MediaSlotField
                key={slot.slot}
                slot={slot}
                value={value.media[slot.slot] ?? []}
                onChange={(refs) => setMedia(slot.slot, refs)}
              />
            ))}
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
  );
}
