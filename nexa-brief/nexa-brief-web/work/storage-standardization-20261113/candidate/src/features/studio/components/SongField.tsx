"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { getLibraryAsset } from "@/features/library/api/library-assets-service";
import { libraryAssetsKey } from "@/features/library/hooks/useLibraryAssets";
import { LyricsViewer, ResourcePicker } from "@/features/resources";
import { AudioResourceOption } from "@/features/resources/components/AudioResourceOption";
import { useLibraryList } from "@/features/resources/hooks/useResources";
import type { TemplateRequirements } from "@/features/templates/types";
import { FieldShell } from "./FieldShell";

/** Canción de la librería y su letra sincronizada. */
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
  if (compact)
    return <CompactSongField key={value} audio={audio} value={value} onChange={onChange} />;
  return <SongChooser audio={audio} value={value} onChange={onChange} showLyrics />;
}

function SongChooser({
  audio,
  value,
  onChange,
  showLyrics,
}: {
  audio: TemplateRequirements["audio"];
  value: string | null;
  onChange: (assetId: string | null) => void;
  showLyrics: boolean;
}) {
  const t = useTranslations("studio.song");
  return (
    <FieldShell
      title={t("title")}
      badge={
        <span className="shrink-0 rounded-full bg-nb-bg-2 px-2 py-0.5 text-[10px] font-semibold text-nb-ink-soft">
          {audio.required ? t("required") : t("optional")}
        </span>
      }
    >
      <ResourcePicker kind="music" allowUpload value={value} onChange={(id) => onChange(id)} />
      {showLyrics && value && audio.lyrics !== "none" && (
        <LyricsSection key={value} assetId={value} />
      )}
    </FieldShell>
  );
}

function LyricsSection({ assetId, visible = true }: { assetId: string; visible?: boolean }) {
  const t = useTranslations("studio.song");
  const [expanded, setExpanded] = useState(true);
  const panelId = useId();
  return (
    <div className="rounded-xl border border-nb-line bg-nb-bg p-2.5">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-bold tracking-[0.06em] text-nb-mute uppercase"
      >
        {t("lyrics")}
        <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <div id={panelId} hidden={!expanded} className="mt-1.5">
        <LyricsViewer assetId={assetId} visible={expanded && visible} />
      </div>
    </div>
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
  const { data: songs, isLoading } = useLibraryList("music");
  const listedSong = songs?.find((song) => song.assetId === value);
  // La lista está limitada a la categoría actual; la selección puede venir de otra.
  const { data: selectedById } = useQuery({
    queryKey: [...libraryAssetsKey("music"), "item", value],
    queryFn: ({ signal }) => getLibraryAsset("music", value as string, signal),
    enabled: Boolean(value && !listedSong && !isLoading),
    retry: false,
  });
  const selected = listedSong ?? selectedById;
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
      <div id={panelId} hidden={!expanded} className="space-y-2.5">
        {value && audio.lyrics !== "none" && (
          <LyricsSection key={value} assetId={value} visible={expanded} />
        )}
        {expanded && (
          <SongChooser audio={audio} value={value} onChange={onChange} showLyrics={false} />
        )}
      </div>
    </section>
  );
}
