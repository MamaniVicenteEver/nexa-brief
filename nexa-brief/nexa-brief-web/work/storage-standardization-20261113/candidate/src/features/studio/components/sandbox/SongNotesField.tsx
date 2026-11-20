"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

/** «Información de la canción» (opcional) antes de Preparar: de qué trata, a quién le habla, nombre y
 * artista… La IA la usa como fuente confiable; sin esto, identifica la canción por su nombre o su letra. */
export function SongNotesField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("studio.songNotes");
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-[11.5px] font-semibold text-nb-ink">
      <span>{t("label")} <span className="font-normal text-nb-mute">{t("optional")}</span></span>
      <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} maxLength={2000} rows={2} placeholder={t("placeholder")} className="w-full resize-y rounded-xl border border-nb-line bg-nb-surface px-3 py-2 text-[12px] font-normal text-nb-ink focus:border-nb-ink focus:outline-none disabled:opacity-60" />
    </label>
  );
}
