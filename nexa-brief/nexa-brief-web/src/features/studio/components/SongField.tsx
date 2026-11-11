"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { LyricsViewer, ResourcePicker } from "@/features/resources";
import { AudioResourceOption } from "@/features/resources/components/AudioResourceOption";
import { useLibraryList } from "@/features/resources/hooks/useResources";
import type { TemplateRequirements } from "@/features/templates/types";
import { FieldShell } from "./FieldShell";

/** Canción de la librería (o subida en el lugar, que se transcribe sola) y su
 * letra sincronizada para chequear la transcripción antes de previsualizar. */
export function SongField({
  compact = false,
  audio,
  value,
  onChange,
}: {
  compact?: boolean;
  audio: TemplateRequirements["audio"];
  value: string | null;
  onChange: (assetId: string | null) => void;
}) {
  const t = useTranslations("studio.song");
  if (compact)
    return <CompactSongField key={value} audio={audio} value={value} onChange={onChange} />;
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

function CompactSongField({
  audio,
  value,
  onChange,
}: {
  audio: TemplateRequirements["audio"];
  value: string | null;
  onChange: (assetId: string | null) => void;
}) {
  const t = useTranslations("studio.song");
  const [expanded, setExpanded] = useState(!value);
  const panelId = useId();
  const { data: songs } = useLibraryList("music");
  const selected = songs?.find((song) => song.assetId === value);
  return (
    <section className="flex flex-col gap-2.5" aria-label={t("title")}>
      {selected && (
        <AudioResourceOption
          asset={selected}
          selected
          onClick={() => setExpanded((open) => !open)}
        />
      )}
      {value && !selected && (
        <p className="text-[12.5px] font-semibold text-nb-ink">{t("selectedSong")}</p>
      )}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
        className="flex items-center justify-between gap-2 rounded-lg px-1 py-2 text-left text-[12px] font-semibold text-nb-ink-soft hover:bg-nb-bg-2"
      >
        {value ? t("chooseAnother") : t("choose")}
        <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <div id={panelId} hidden={!expanded}>
        {expanded && <SongField audio={audio} value={value} onChange={onChange} />}
      </div>
    </section>
  );
}
