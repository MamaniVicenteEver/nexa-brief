"use client";

import { useTranslations } from "next-intl";

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
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between text-[11.5px] font-semibold text-nb-ink">
        {t("label")}
        <span className="text-[10.5px] font-normal text-nb-mute">{t("optional")}</span>
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={2000}
        rows={3}
        placeholder={t("placeholder")}
        className="w-full resize-y rounded-xl border border-nb-line bg-nb-surface px-3 py-2 text-[12px] text-nb-ink focus:border-nb-ink focus:outline-none disabled:opacity-60"
      />
      <span className="text-[10.5px] text-nb-mute">{t("hint")}</span>
    </label>
  );
}
