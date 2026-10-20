"use client";

import { Loader2, Pencil, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { isDraftRunning } from "../../hooks/useDraft";
import type { OriginalController } from "../../hooks/useOriginalDraft";
import { DraftProgress } from "../DraftProgress";
import { DetailsEditor } from "../sandbox/DetailsEditor";
import { SongNotesField } from "../sandbox/SongNotesField";
import { PublicationCards } from "./PublicationCards";

/** Lo que se publicaría en YouTube, Facebook, Instagram y TikTok si se graba la plantilla tal cual.
 * La primera vez se prepara (canción, títulos, descripciones y etiquetas); después se puede editar. */
export function OriginalPublication({ original }: { original: OriginalController }) {
  const t = useTranslations("studio.original");
  const [editing, setEditing] = useState(false);
  const { draft } = original;
  const [notes, setNotes] = useState(draft?.songNotes ?? "");
  const details = draft?.details ?? null;
  const working = original.ensure.isPending || isDraftRunning(draft);
  const error = original.ensure.error ?? original.saveDetails.error;

  if (details && editing && draft) {
    return (
      <DetailsEditor
        key={draft.updatedAt}
        details={details}
        saving={original.saveDetails.isPending}
        onSave={(next) => original.saveDetails.mutate(next, { onSuccess: () => setEditing(false) })}
        onClose={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11.5px] text-nb-mute">{t("publicationHint")}</p>
      {draft && (working || draft.status === "failed") && (
        <DraftProgress draft={draft} dirty={false} />
      )}
      {error && <p className="text-[11.5px] text-nb-accent-coral">{error.message}</p>}
      {details ? (
        <>
          <PublicationCards details={details} />
          <SongNotesField value={notes} onChange={setNotes} disabled={working} />
          {notes.trim() && notes.trim() !== draft?.songNotes && (
            <button
              type="button"
              disabled={working}
              onClick={() => original.ensure.mutate(notes)}
              className="flex items-center justify-center gap-1.5 rounded-full bg-nb-ink px-4 py-2 text-[12.5px] font-bold text-nb-surface disabled:opacity-60"
            >
              {working ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {t("prepareAgain")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center justify-center gap-1.5 rounded-full border border-nb-line px-4 py-2 text-[12.5px] font-semibold text-nb-ink hover:bg-nb-bg-2"
          >
            <Pencil className="size-3.5" />
            {t("editPublication")}
          </button>
        </>
      ) : (
        <>
          <SongNotesField value={notes} onChange={setNotes} disabled={working} />
          <button
            type="button"
            disabled={working}
            onClick={() => original.ensure.mutate(notes)}
            className="flex items-center justify-center gap-2 rounded-full bg-nb-ink px-5 py-2.5 text-[13px] font-bold text-nb-surface disabled:opacity-60"
          >
            {working ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {working ? t("preparing") : t("preparePublication")}
          </button>
        </>
      )}
    </div>
  );
}
