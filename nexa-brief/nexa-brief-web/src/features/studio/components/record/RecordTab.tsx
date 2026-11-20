"use client";

import { Clapperboard, FlaskConical, Loader2, Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { BrandAccountPicker } from "@/shared/components/publish/BrandAccountPicker";
import { prepareDraft } from "../../api/studio-service";
import { draftKey, draftsKey, isDraftRunning } from "../../hooks/useDraft";
import { useDraftThumbnailEditor } from "../../hooks/useDraftThumbnailEditor";
import { usePublishCategoryGroups } from "../../hooks/usePublishCategoryGroups";
import { isRecordable } from "../../hooks/useRecordPrototype";
import type { TemplateStudioController } from "../../hooks/useTemplateStudio";
import { DEFAULT_RECORD_OUTPUTS, type RecordOutput } from "../../types";
import { DraftProgress } from "../DraftProgress";
import { FieldShell } from "../FieldShell";
import { SongNotesField } from "../sandbox/SongNotesField";
import { DetailsAccordion } from "./DetailsAccordion";
import { IntroSongFields } from "./IntroSongFields";
import { PrototypePicker } from "./PrototypePicker";

/** Grabar: prototipo preparado → detalles (acordeón) → motor → formatos → canales → Grabar. */
export function RecordTab({ studio }: { studio: TemplateStudioController }) {
  const t = useTranslations("studio.record");
  const tr = useTranslations("studio.render");
  const { recorder } = studio;
  const { groups, unavailable, isLoading, isError, retry } = usePublishCategoryGroups();
  const tt = useTranslations("studio.thumbnails");
  const accounts = groups.flatMap((g) => g.accounts);
  const selected = recorder.selected;
  const thumbnailEditor = useDraftThumbnailEditor(selected);
  // Prototipos preparados (y el elegido aunque ya esté grabándose o grabado, para ver su estado).
  const prototypes =
    selected && !selected.original && !recorder.recordable.includes(selected)
      ? [selected, ...recorder.recordable]
      : recorder.recordable;
  const original = studio.original;
  const [originalNotes, setOriginalNotes] = useState("");
  const [dirtyArtistDraftId, setDirtyArtistDraftId] = useState<string | null>(null);
  const artistDirty = !!selected && dirtyArtistDraftId === selected.draftId;
  const outputLabels: Record<RecordOutput, string> = {
    tiktok: "TikTok",
    instagram: "Instagram",
    facebook: "Facebook",
    youtube: t("youtubeNormal"),
    youtube_shorts: "YouTube Shorts",
  };
  const recording = recorder.render.isPending || isDraftRunning(selected);
  const queryClient = useQueryClient();
  const generateData = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("no draft");
      return prepareDraft(selected.draftId);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(draftKey(updated.draftId), updated);
      void queryClient.invalidateQueries({ queryKey: draftsKey(updated.templateId) });
    },
  });
  const pending = selected?.pending ?? [];
  // Con datos pendientes se puede grabar sin cuentas; publicar espera a que estén generados.
  const blockedByPending = pending.length > 0 && recorder.accounts.length > 0;
  const busy = recording || thumbnailEditor.isSaving || thumbnailEditor.isSelecting;
  const missingOutput = recorder.accounts.some((selector) =>
    !accounts.some((account) => account.selector === selector) || !recorder.hasOutputForAccount(selector),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-3">
        <FieldShell title={t("prototype")}>
          <PrototypePicker
            original={original.draft}
            prototypes={prototypes}
            choice={recorder.choice}
            onSelect={recorder.select}
            disabled={thumbnailEditor.isSaving || thumbnailEditor.hasError || artistDirty}
          />
          {prototypes.length === 0 &&
            !(
              original.draft &&
              (isRecordable(original.draft) ||
                (recorder.isOriginal && original.draft.status === "rendering"))
            ) && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[12px] text-nb-mute">{t("empty")}</p>
                <button
                  type="button"
                  onClick={() => studio.setTab("sandbox")}
                  className="flex items-center gap-1.5 self-start text-[11.5px] font-semibold text-nb-mute hover:text-nb-ink"
                >
                  <FlaskConical className="size-3.5" />
                  {t("goSandbox")}
                </button>
              </div>
            )}
        </FieldShell>

        {recorder.isOriginal && !selected?.details && (
          <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-nb-line p-3">
            <p className="text-[12px] text-nb-ink-soft">{t("originalNotPrepared")}</p>
            <SongNotesField value={originalNotes} onChange={setOriginalNotes} />
            {selected && isDraftRunning(selected) && (
              <DraftProgress draft={selected} dirty={false} />
            )}
            {original.ensure.error && (
              <p className="text-[11.5px] text-nb-accent-coral">{original.ensure.error.message}</p>
            )}
            <button
              type="button"
              disabled={original.ensure.isPending || isDraftRunning(selected)}
              onClick={() => original.ensure.mutate(originalNotes)}
              className="flex items-center justify-center gap-2 rounded-full bg-nb-ink px-4 py-2 text-[12.5px] font-bold text-nb-surface disabled:opacity-60"
            >
              {original.ensure.isPending || isDraftRunning(selected) ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {t("prepareOriginal")}
            </button>
          </div>
        )}

        {selected?.details && (
          <IntroSongFields
            key={selected.draftId}
            draft={selected}
            details={selected.details}
            thumbnailEditor={thumbnailEditor}
            onArtistDirtyChange={(dirty) => setDirtyArtistDraftId(dirty ? selected.draftId : null)}
          />
        )}

        {selected?.details && <DetailsAccordion details={selected.details} />}

        {!recorder.hyperframesSupported && (
          <p role="alert" className="text-[12px] text-nb-accent-coral">
            {tr("hyperframesUnsupported")}
          </p>
        )}

        <FieldShell title={t("formats")} hint={t("formatsHint")}>
          <div className="grid grid-cols-2 gap-2">
            {DEFAULT_RECORD_OUTPUTS.map((output) => {
              const checked = recorder.outputs.includes(output);
              return (
                <label
                  key={output}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px]",
                    checked ? "border-nb-ink bg-nb-bg-2" : "border-nb-line",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => recorder.setOutput(output, event.target.checked)}
                    className="size-4 accent-black"
                  />
                  {outputLabels[output]}
                </label>
              );
            })}
          </div>
        </FieldShell>

        <FieldShell title={t("publish")} hint={t("publishHint")}>
          {isLoading && <p className="text-[12px] text-nb-mute">{tr("loadingAccounts")}</p>}
          {isError && (
            <div role="alert" className="text-[12px] text-nb-accent-coral">
              {tt("accountsError")}{" "}
              <button type="button" onClick={retry} className="underline">
                {tt("retryAccounts")}
              </button>
            </div>
          )}
          {!isLoading && !isError && groups.length === 0 && (
            <p className="text-[12px] text-nb-mute">{tr("noAccounts")}</p>
          )}
          <BrandAccountPicker
            groups={groups}
            isDisabled={(account) =>
              unavailable.has(account.selector) && !recorder.accounts.includes(account.selector)
            }
            renderBadge={(account) =>
              unavailable.has(account.selector) ? (
                <span className="text-[10px] text-nb-accent-coral">{tt("reauth")}</span>
              ) : null
            }
            selected={recorder.accounts}
            onChange={recorder.setAccounts}
          />
          {missingOutput && (
            <p role="alert" className="mt-2 text-[11.5px] text-nb-accent-coral">
              {t("missingOutputForAccount")}
            </p>
          )}
        </FieldShell>
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-nb-line p-3">
        {selected &&
          (isDraftRunning(selected) ||
            selected.status === "rendered" ||
            selected.status === "failed") && <DraftProgress draft={selected} dirty={false} />}
        {artistDirty && <p className="text-[11px] text-nb-mute">{t("saveArtistFirst")}</p>}
        {recorder.render.error && (
          <p className="text-[11.5px] text-nb-accent-coral">{recorder.render.error.message}</p>
        )}
        {pending.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-nb-accent-coral/40 bg-nb-accent-coral/10 p-3">
            <p className="text-[12px] font-bold text-nb-accent-coral">{t("pendingTitle")}</p>
            <ul className="list-disc pl-4 text-[11.5px] text-nb-ink">
              {pending.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-[11px] text-nb-mute">
              {blockedByPending ? t("pendingBlocksPublish") : t("pendingCanRecord")}
            </p>
            <button
              type="button"
              disabled={generateData.isPending || busy || !selected}
              onClick={() => generateData.mutate()}
              className="self-start rounded-full bg-nb-accent-coral px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
            >
              {generateData.isPending ? t("generatingData") : t("generateData")}
            </button>
          </div>
        )}
        <button
          type="button"
          disabled={
            !selected ||
            busy ||
            missingOutput ||
            !recorder.ready ||
            thumbnailEditor.hasError ||
            artistDirty ||
            blockedByPending
          }
          onClick={async () => {
            if (!selected) return;
            try {
              await thumbnailEditor.flush();
              recorder.render.mutate(selected);
            } catch {
              // El editor muestra el error y bloquea Grabar hasta reintentar el guardado.
            }
          }}
          className="flex items-center justify-center gap-2 rounded-full bg-nb-accent-coral px-5 py-2.5 text-[13px] font-bold text-white transition-opacity disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
          {recording
            ? t("recording")
            : thumbnailEditor.isSaving || thumbnailEditor.isSelecting
              ? tt(thumbnailEditor.isSelecting ? "choosing" : "saving")
              : recorder.accounts.length > 0
                ? t("recordAndPublish", { count: recorder.accounts.length })
                : t("record")}
        </button>
      </div>
    </div>
  );
}
