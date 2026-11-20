"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Niche } from "@/features/create-video/types";
import type { Template } from "@/features/templates/types";
import { useJobsTrayStore } from "@/shared/store/jobs-tray-store";
import { renderDraft } from "../api/studio-service";
import { DEFAULT_RECORD_OUTPUTS, RECORD_OUTPUT_FORMAT, type Draft, type RecordOutput, type RecorderEngine, type RecordFormat } from "../types";
import { backgroundVisibility, supportsBackgroundVisibility } from "../services/background-visibility";
import { draftKey, draftsKey } from "./useDraft";

/** Opción «Video original» en el selector (la plantilla tal cual). */
export const ORIGINAL = "__original";

export const ENGINE_ORDER: RecorderEngine[] = ["hyperframes", "remotion", "playwright"];

/** Se puede grabar un prototipo preparado (o uno cuya grabación falló y se puede reintentar). */
export function isRecordable(draft: Draft): boolean {
  return draft.status === "prepared" || (draft.status === "failed" && draft.recoverable);
}

export function songTitle(draft: Draft, songs?: { assetId: string; title: string }[]): string {
  return songs?.find((song) => song.assetId === draft.inputs?.musicAssetId)?.title?.trim() || draft.details?.songName?.trim() || "";
}

export function prototypeLabel(draft: Draft, fallback: string, songs?: { assetId: string; title: string }[]): string {
  if (draft.original) return "Demo";
  const name = draft.name?.trim() || "";
  const song = songTitle(draft, songs);
  return ((!name || /^prototipo\s+\d+$/i.test(name)) && song) || name || fallback;
}

/** Pestaña Grabar: qué grabar (el «Video original» o un prototipo preparado), motor (HyperFrames
 * por defecto), formatos (16:9 por defecto) y en qué cuentas publicar. Al grabar, el trabajo
 * aparece en «Videos en proceso». */
export function useRecordPrototype(
  template: Template,
  niche: Niche | undefined,
  prototypes: Draft[],
  original: Draft | null,
  open = true,
) {
  const queryClient = useQueryClient();
  const addJobs = useJobsTrayStore((s) => s.addJobs);
  const recordable = prototypes.filter(isRecordable);
  const originalReady = original !== null && isRecordable(original);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Sin elegir: el primer prototipo preparado; si no hay ninguno, el original.
  const choice =
    selectedId && ((selectedId === ORIGINAL && (originalReady || original?.status === "rendering")) || prototypes.some((d) => d.draftId === selectedId && (isRecordable(d) || d.status === "rendering")))
      ? selectedId
      : (originalReady ? ORIGINAL : (recordable[0]?.draftId ?? ""));
  const selected =
    choice === ORIGINAL ? original : (prototypes.find((d) => d.draftId === choice) ?? null);

  const engines = ENGINE_ORDER;
  const engine = "hyperframes" as const;
  const hyperframesSupported = niche?.supportedEngines.includes(engine) ?? false;
  const [outputs, setOutputs] = useState<RecordOutput[]>([...DEFAULT_RECORD_OUTPUTS]);
  useEffect(() => {
    if (!open) setOutputs([...DEFAULT_RECORD_OUTPUTS]);
  }, [open]);
  const formats: RecordFormat[] = [
    ...(outputs.some((output) => RECORD_OUTPUT_FORMAT[output] === "16x9") ? ["16x9" as const] : []),
    ...(outputs.some((output) => RECORD_OUTPUT_FORMAT[output] === "9x16") ? ["9x16" as const] : []),
  ];
  const setOutput = (output: RecordOutput, checked: boolean) =>
    setOutputs((previous) => checked
      ? (previous.includes(output) ? previous : [...previous, output])
      : previous.filter((item) => item !== output));
  const hasOutputForAccount = (selector: string) => {
    const platform = selector.split(":", 1)[0];
    return outputs.includes(platform as RecordOutput) ||
      (platform === "youtube" && outputs.includes("youtube_shorts"));
  };
  const [accounts, setAccounts] = useState<string[]>([]);

  const render = useMutation({
    mutationFn: async (draft: Draft) => {
      const result = await renderDraft(draft.draftId, {
        recorderEngine: engine,
        backgroundOpacity: !draft.original && supportsBackgroundVisibility(template.id) &&
          (draft.inputs.templateInputs?.media?.background?.length || draft.inputs.imageAssetId || draft.inputs.videoAssetId)
          ? (backgroundVisibility.get(draft.draftId) ?? 0.8) : undefined,
        publishAccounts: accounts,
        outputs,
      });
      return { draft, result };
    },
    onSuccess: ({ draft, result }) => {
      setSelectedId(draft.original ? ORIGINAL : draft.draftId);
      addJobs([
        {
          jobId: result.job_id,
          category: template.nicheId,
          label: `${template.displayName} · ${prototypeLabel(draft, template.displayName)}`,
        },
      ]);
      queryClient.invalidateQueries({ queryKey: draftKey(draft.draftId) });
      queryClient.invalidateQueries({ queryKey: draftsKey(template.id) });
      queryClient.invalidateQueries({ queryKey: ["template-videos", template.id] });
    },
  });

  return {
    recordable,
    choice,
    isOriginal: choice === ORIGINAL,
    selected,
    /** El elegido está listo para grabar (preparado o reintentable). */
    ready: selected !== null && isRecordable(selected) && hyperframesSupported && outputs.length > 0,
    select: setSelectedId,
    engines,
    defaultEngine: niche?.recorderEngine as RecorderEngine | undefined,
    engine,
    hyperframesSupported,
    formats,
    outputs,
    setOutput,
    hasOutputForAccount,
    accounts,
    setAccounts,
    render,
  };
}

export type RecordController = ReturnType<typeof useRecordPrototype>;
