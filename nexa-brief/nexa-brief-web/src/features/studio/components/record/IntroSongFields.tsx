"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { saveDraftDetails } from "../../api/studio-service";
import { draftKey, draftsKey } from "../../hooks/useDraft";
import type { DraftThumbnailEditor } from "../../hooks/useDraftThumbnailEditor";
import type { Draft, DraftDetails } from "../../types";
import { DraftThumbnailPicker } from "./DraftThumbnailPicker";

const FIELD =
  "min-w-0 flex-1 rounded-xl border border-nb-line bg-nb-surface px-3 py-2 text-[12.5px] text-nb-ink focus:border-nb-ink focus:outline-none";

/** El título A/B de la miniatura y el artista de la intro se editan aquí. */
export function IntroSongFields({
  draft,
  details,
  thumbnailEditor,
}: {
  draft: Draft;
  details: DraftDetails;
  thumbnailEditor: DraftThumbnailEditor;
}) {
  const t = useTranslations("studio.introSong");
  const queryClient = useQueryClient();
  const [artist, setArtist] = useState(details.artist);
  const save = useMutation({
    mutationFn: () => saveDraftDetails(draft.draftId, { ...details, artist: artist.trim() }),
    onSuccess: (updated) => {
      queryClient.setQueryData(draftKey(updated.draftId), updated);
      void queryClient.invalidateQueries({ queryKey: draftsKey(updated.templateId) });
    },
  });
  const changed = artist.trim() !== details.artist;

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-nb-line p-3">
      <div>
        <p className="text-[12px] font-bold text-nb-ink">{t("title")}</p>
        <p className="text-[11px] text-nb-mute">{t("hint")}</p>
      </div>
      <DraftThumbnailPicker draft={draft} editor={thumbnailEditor} disabled={save.isPending} />
      <label className="flex flex-col gap-1 text-[11px] font-semibold text-nb-mute">
        {t("artist")}
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder={t("artist")}
          aria-label={t("artist")}
          className={FIELD}
        />
      </label>
      {save.error && <p className="text-[11px] text-nb-accent-coral">{save.error.message}</p>}
      {changed && (
        <button
          type="button"
          disabled={save.isPending || thumbnailEditor.isSaving || thumbnailEditor.hasError}
          onClick={async () => {
            try {
              await thumbnailEditor.flush();
              await save.mutateAsync();
            } catch {
              // El error del editor o de la mutación queda visible junto al formulario.
            }
          }}
          className="flex items-center justify-center gap-1.5 self-end rounded-full bg-nb-ink px-4 py-1.5 text-[12px] font-bold text-nb-surface disabled:opacity-50"
        >
          {save.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          {t("save")}
        </button>
      )}
    </section>
  );
}
