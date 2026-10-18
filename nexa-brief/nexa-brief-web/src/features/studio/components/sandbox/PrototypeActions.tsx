"use client";

import { Clapperboard, Eye, FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TemplateStudioController } from "../../hooks/useTemplateStudio";
import { missingRequirements } from "../../lib/draft-request";
import { SongNotesField } from "./SongNotesField";

const PRIMARY =
  "flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold transition-opacity disabled:opacity-50";
const SECONDARY =
  "flex items-center justify-center gap-1.5 rounded-full border border-nb-line px-3.5 py-2.5 text-[12.5px] font-semibold text-nb-ink hover:bg-nb-bg-2";

/** Previsualizar → Preparar → Detalles / Grabar: el botón cambia según el paso del prototipo. */
export function PrototypeActions({
  studio,
  showingDetails,
  onToggleDetails,
}: {
  studio: TemplateStudioController;
  showingDetails: boolean;
  onToggleDetails: () => void;
}) {
  const t = useTranslations("studio.sandbox.actions");
  const { editor } = studio;
  const req = studio.requirements.data;
  const draft = editor.draft;

  if (editor.step === "busy") {
    return (
      <button type="button" disabled className={`${PRIMARY} nb-btn-pill`}>
        <Loader2 className="size-4 animate-spin" />
        {draft?.status === "preparing" || editor.prepare.isPending ? t("preparing") : t("working")}
      </button>
    );
  }

  if (editor.step === "preview") {
    const missing = req ? missingRequirements(req, editor.value) : null;
    return (
      <>
        {!editor.complete && missing && (
          <p className="text-[11.5px] text-nb-mute">
            {missing.song ? t("missingSong") : t("missingMedia")}
          </p>
        )}
        <button
          type="button"
          onClick={() => editor.preview.mutate()}
          disabled={!editor.complete}
          className={`${PRIMARY} nb-btn-pill`}
        >
          <Eye className="size-4" />
          {draft ? t("previewAgain") : t("preview")}
        </button>
      </>
    );
  }

  if (editor.step === "prepare") {
    return (
      <>
        <p className="text-[11.5px] text-nb-mute">{t("prepareHint")}</p>
        <SongNotesField value={editor.songNotes} onChange={editor.setSongNotes} />
        <button
          type="button"
          onClick={() => editor.prepare.mutate()}
          className={`${PRIMARY} bg-nb-ink text-nb-surface`}
        >
          <Sparkles className="size-4" />
          {t("prepare")}
        </button>
      </>
    );
  }

  // prepared / rendered: Detalles + (Grabar | volver a preparar)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" onClick={onToggleDetails} className={SECONDARY}>
          <FileText className="size-3.5" />
          {showingDetails ? t("hideDetails") : t("details")}
        </button>
        {editor.step === "prepared" && draft && (
          <button
            type="button"
            onClick={() => studio.recordPrototype(draft.draftId)}
            className={`${PRIMARY} bg-nb-accent-coral text-white`}
          >
            <Clapperboard className="size-4" />
            {t("goRecord")}
          </button>
        )}
      </div>
      {editor.step === "prepared" && (
        <SongNotesField value={editor.songNotes} onChange={editor.setSongNotes} />
      )}
      {editor.step === "prepared" && (
        <button
          type="button"
          onClick={() => {
            if (!draft?.details?.edited || window.confirm(t("prepareAgainConfirm"))) {
              editor.prepare.mutate();
            }
          }}
          className="flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-nb-mute hover:text-nb-ink"
        >
          <RefreshCw className="size-3" />
          {t("prepareAgain")}
        </button>
      )}
    </div>
  );
}
