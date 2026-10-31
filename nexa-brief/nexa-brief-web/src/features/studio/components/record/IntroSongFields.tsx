"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { saveDraftDetails } from "../../api/studio-service";
import { draftKey, draftsKey } from "../../hooks/useDraft";
import type { Draft, DraftDetails } from "../../types";

const FIELD =
  "min-w-0 flex-1 rounded-xl border border-nb-line bg-nb-surface px-3 py-2 text-[12.5px] text-nb-ink focus:border-nb-ink focus:outline-none";

/** La canción que muestra la tarjeta de intro del video (y los textos de publicación): se cambia
 * acá antes de grabar; el backend la escribe en el config del prototipo. */
export function IntroSongFields({ draft, details }: { draft: Draft; details: DraftDetails }) {
  const t = useTranslations("studio.introSong");
  const queryClient = useQueryClient();
  const [song, setSong] = useState(details.songName);
  const [artist, setArtist] = useState(details.artist);
  const save = useMutation({
    mutationFn: () =>
      saveDraftDetails(draft.draftId, { ...details, songName: song.trim(), artist: artist.trim() }),
    onSuccess: (updated) => {
      queryClient.setQueryData(draftKey(updated.draftId), updated);
      queryClient.invalidateQueries({ queryKey: draftsKey(updated.templateId) });
    },
  });
  const changed = song.trim() !== details.songName || artist.trim() !== details.artist;

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-nb-line p-3">
      <div>
        <h3 className="text-[12.5px] font-bold text-nb-ink">{t("title")}</h3>
        <p className="text-[11px] text-nb-mute">{t("hint")}</p>
      </div>
      <div className="flex gap-2">
        <input
          value={song}
          onChange={(e) => setSong(e.target.value)}
          placeholder={t("song")}
          aria-label={t("song")}
          className={FIELD}
        />
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder={t("artist")}
          aria-label={t("artist")}
          className={FIELD}
        />
      </div>
      {save.error && <p className="text-[11px] text-nb-accent-coral">{save.error.message}</p>}
      {changed && (
        <button
          type="button"
          disabled={!song.trim() || save.isPending}
          onClick={() => save.mutate()}
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
