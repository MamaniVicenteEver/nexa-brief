"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { prepareDraftThumbnails } from "../../api/studio-service";
import { draftKey, draftsKey, isDraftRunning } from "../../hooks/useDraft";
import {
  type DraftThumbnailEditor,
  useDraftThumbnailEditor,
} from "../../hooks/useDraftThumbnailEditor";
import type { Draft, DraftThumbnailOptionId } from "../../types";
import { useThumbnailStage } from "../ThumbnailStageContext";
import { DraftThumbnailArtwork, retryDraftThumbnailRenderer } from "./DraftThumbnailArtwork";
import { DraftThumbnailControls } from "./DraftThumbnailControls";

const OPTIONS: DraftThumbnailOptionId[] = ["A", "B"];

/** Miniaturas estáticas/JSON: abrir o comparar no modal nunca inicia capturas. */
export function DraftThumbnailPicker({
  draft,
  disabled = false,
  editor: sharedEditor,
  artistField,
}: {
  draft: Draft;
  disabled?: boolean;
  editor?: DraftThumbnailEditor;
  artistField?: ReactNode;
}) {
  const t = useTranslations("studio.thumbnails");
  const song = useTranslations("studio.introSong");
  const client = useQueryClient();
  const { preview, setPreview } = useThumbnailStage();
  const [rendererFailed, setRendererFailed] = useState(false);
  const [rendererRetryKey, setRendererRetryKey] = useState(0);
  const localEditor = useDraftThumbnailEditor(sharedEditor ? null : draft);
  const editor = sharedEditor ?? localEditor;
  const manifestKey = JSON.stringify(editor.manifest);
  useEffect(() => {
    if (preview?.draftId === draft.draftId && JSON.stringify(preview.manifest) !== manifestKey) {
      setPreview({ ...preview, manifest: JSON.parse(manifestKey) });
    }
  }, [preview, setPreview, draft.draftId, manifestKey]);
  const markRendererFailed = useCallback(() => setRendererFailed(true), []);
  const prepare = useMutation({
    mutationFn: () => prepareDraftThumbnails(draft.draftId),
    onSuccess: (next) => {
      client.setQueryData(draftKey(next.draftId), next);
      void client.invalidateQueries({ queryKey: draftsKey(next.templateId) });
    },
  });
  const running = isDraftRunning(draft);
  const preparing = running || prepare.isPending;
  const locked = disabled || preparing || draft.status === "rendered";
  const error = prepare.error?.message || editor.error || draft.thumbnailError;
  const editorial = draft.templateId === "promo-editorial";
  const wordLimit =
    editor.editingOption === "A" || !editorial
      ? 5
      : Math.max(1, Math.min(5, editor.options.A.text.trim().split(/\s+/).filter(Boolean).length));
  const textField = (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-semibold text-nb-mute">
      {t("textLabel")}
      <input
        value={editor.text}
        onChange={(event) =>
          editor.setText(
            (editor.editingOption === "A" || editorial) &&
              event.target.value.trim().split(/\s+/).length > wordLimit
              ? event.target.value.trim().split(/\s+/).slice(0, wordLimit).join(" ")
              : event.target.value,
          )
        }
        disabled={locked || !draft.thumbnails}
        maxLength={200}
        aria-label={song("song")}
        className="w-full rounded-xl border border-nb-line bg-nb-surface px-3 py-2 text-[12.5px] text-nb-ink focus:border-nb-ink focus:outline-none disabled:opacity-60"
      />
    </label>
  );

  const optionCard = (option: DraftThumbnailOptionId) => {
    const selected = editor.selected === option;
    const viewing = preview?.draftId === draft.draftId && preview.option === option;
    return (
      <article
        key={option}
        className={cn(
          "relative min-w-0 overflow-hidden rounded-xl border bg-nb-surface",
          selected ? "border-nb-green-dark ring-2 ring-nb-green" : "border-nb-line",
        )}
      >
        <button
          type="button"
          aria-pressed={selected}
          aria-label={t("chooseOption", { option })}
          disabled={locked}
          onClick={() => {
            void editor.choose(option).catch(() => undefined);
            if (preview?.draftId === draft.draftId)
              setPreview({
                draftId: draft.draftId,
                option,
                manifest: editor.manifest,
              });
          }}
          className="block w-full text-left disabled:opacity-60"
        >
          <DraftThumbnailArtwork
            manifest={editor.manifest}
            option={option}
            fallbackUrl={draft.thumbnails?.urls[option]}
            retryKey={rendererRetryKey}
            onRendererError={markRendererFailed}
            className="rounded-t-xl"
          />
          <span className="flex h-9 items-center gap-1 px-2 text-[11px] font-bold text-nb-ink">
            {option}
            {selected && <Check aria-label={t("chosen")} className="size-3 text-nb-green-dark" />}
          </span>
        </button>
        <button
          type="button"
          aria-label={t("viewOption", { option })}
          title={viewing ? t("stopViewing") : t("viewOption", { option })}
          aria-pressed={viewing}
          onClick={() => {
            editor.editOption(option);
            setPreview(
              viewing ? null : { draftId: draft.draftId, option, manifest: editor.manifest },
            );
          }}
          className={cn(
            "absolute right-1 bottom-1 flex size-7 items-center justify-center rounded-full",
            viewing ? "bg-nb-ink text-nb-surface" : "text-nb-ink-soft hover:bg-nb-bg-2",
          )}
        >
          <Eye aria-hidden="true" className="size-4" />
        </button>
      </article>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] font-bold text-nb-ink">{t("title")}</p>

      {draft.thumbnails && (
        <>
          <fieldset aria-label={t("title")} className="grid grid-cols-2 gap-2">
            {OPTIONS.map((option) => optionCard(option))}
          </fieldset>
          <p className="pt-1 text-[11px] font-semibold text-nb-ink">
            {t("editingOption", { option: editor.editingOption })}
          </p>
          {artistField}
          {textField}
          <p className="text-[10.5px] text-nb-mute">
            {editorial && editor.editingOption === "B"
              ? t("shortPromoHint", { words: wordLimit })
              : t(editor.editingOption === "A" ? "shortCopyHint" : "longCopyHint")}
          </p>
          <DraftThumbnailControls editor={editor} disabled={locked || !draft.thumbnails} />
        </>
      )}
      {!draft.thumbnails && artistField}

      {editor.hasLocalChanges && !editor.isSaving && (
        <p className="text-[10.5px] text-nb-mute">
          {t(editor.isLocalStored ? "savedLocally" : "keptInMemory")}
        </p>
      )}
      {(preparing || editor.isSaving || editor.isSelecting) && (
        <p role="status" className="flex items-center gap-1 text-[11px] text-nb-mute">
          <Loader2 className="size-3 animate-spin" />
          {preparing ? t("preparing") : editor.isSelecting ? t("choosing") : t("saving")}
        </p>
      )}
      {(error || rendererFailed) && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-nb-accent-coral"
        >
          <span>{error || t("previewUnavailable")}</span>
          {editor.hasError && (
            <button
              type="button"
              onClick={() => void editor.retry().catch(() => undefined)}
              className="font-semibold underline"
            >
              {t("retrySave")}
            </button>
          )}
          {rendererFailed && (
            <button
              type="button"
              onClick={() => {
                setRendererFailed(false);
                setRendererRetryKey((key) => key + 1);
                void retryDraftThumbnailRenderer().then((renderer) => {
                  if (!renderer) setRendererFailed(true);
                });
              }}
              className="font-semibold underline"
            >
              {t("retryPreview")}
            </button>
          )}
        </div>
      )}
      {!draft.thumbnails && (
        <button
          type="button"
          disabled={locked}
          onClick={() => prepare.mutate()}
          className="self-start rounded-full border border-nb-line px-3 py-1.5 text-[11.5px] font-semibold disabled:opacity-50"
        >
          {draft.thumbnailError ? t("retry") : t("prepare")}
        </button>
      )}
      {disabled && <p className="text-[11px] text-nb-mute">{t("saveFirst")}</p>}
    </div>
  );
}
