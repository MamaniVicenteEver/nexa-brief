"use client";

import { useTranslations } from "next-intl";
import { LyricsViewer, ResourcePicker } from "@/features/resources";
import type { TemplateRequirements } from "@/features/templates/types";
import { FieldShell } from "./FieldShell";

/** Canción de la librería (o subida en el lugar, que se transcribe sola) y su
 * letra sincronizada para chequear la transcripción antes de previsualizar. */
export function SongField({
  audio,
  value,
  onChange,
}: {
  audio: TemplateRequirements["audio"];
  value: string | null;
  onChange: (assetId: string | null) => void;
}) {
  const t = useTranslations("studio.song");
  return (
    <FieldShell
      title={t("title")}
      hint={audio.lyrics === "auto" ? t("hintLyrics") : t("hint")}
      badge={
        <span className="shrink-0 rounded-full bg-nb-bg-2 px-2 py-0.5 text-[10px] font-semibold text-nb-ink-soft">
          {audio.required ? t("required") : t("optional")}
        </span>
      }
    >
      <ResourcePicker kind="music" allowUpload value={value} onChange={(id) => onChange(id)} />
      {value && audio.lyrics !== "none" && (
        <div className="rounded-xl border border-nb-line bg-nb-bg p-2.5">
          <p className="mb-1.5 text-[11px] font-bold tracking-[0.06em] text-nb-mute uppercase">
            {t("lyrics")}
          </p>
          {/* Sin max-h acá: el visor es una columna flex y achicaría su propio
              <audio>; la lista de palabras ya scrollea por dentro. */}
          <LyricsViewer key={value} assetId={value} />
        </div>
      )}
    </FieldShell>
  );
}
