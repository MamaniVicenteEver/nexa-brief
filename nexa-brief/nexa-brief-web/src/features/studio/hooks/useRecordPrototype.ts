"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Niche } from "@/features/create-video/types";
import type { Template } from "@/features/templates/types";
import { useJobsTrayStore } from "@/shared/store/jobs-tray-store";
import { renderDraft } from "../api/studio-service";
import type { Draft, RecorderEngine, RecordFormat } from "../types";
import { draftKey, draftsKey } from "./useDraft";

/** Opción «Video original» en el selector (la plantilla tal cual). */
export const ORIGINAL = "__original";

export const ENGINE_ORDER: RecorderEngine[] = ["hyperframes", "remotion", "playwright"];

/** Se puede grabar un prototipo preparado (o uno cuya grabación falló y se puede reintentar). */
export function isRecordable(draft: Draft): boolean {
  return draft.status === "prepared" || (draft.status === "failed" && draft.recoverable);
}

export function prototypeLabel(draft: Draft, fallback: string): string {
  return draft.name || draft.details?.songName || fallback;
}

/** Pestaña Grabar: qué grabar (el «Video original» o un prototipo preparado), motor (HyperFrames
 * por defecto), formatos (16:9 por defecto) y en qué cuentas publicar. Al grabar, el trabajo
 * aparece en «Videos en proceso». */
export function useRecordPrototype(
  template: Template,
  niche: Niche | undefined,
  prototypes: Draft[],
  original: Draft | null,
) {
  const queryClient = useQueryClient();
  const addJobs = useJobsTrayStore((s) => s.addJobs);
  const recordable = prototypes.filter(isRecordable);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Sin elegir: el primer prototipo preparado; si no hay ninguno, el original.
  const choice =
    selectedId && (selectedId === ORIGINAL || prototypes.some((d) => d.draftId === selectedId))
      ? selectedId
      : (recordable[0]?.draftId ?? ORIGINAL);
  const selected =
    choice === ORIGINAL ? original : (prototypes.find((d) => d.draftId === choice) ?? null);

  const engines = ENGINE_ORDER.filter((e) => niche?.supportedEngines.includes(e));
  const defaultEngine: RecorderEngine | undefined = engines.includes("hyperframes")
    ? "hyperframes"
    : ((niche?.recorderEngine as RecorderEngine | undefined) ?? engines[0]);
  const [engineChoice, setEngine] = useState<RecorderEngine | undefined>(undefined);
  const engine = engineChoice && engines.includes(engineChoice) ? engineChoice : defaultEngine;
  // Remotion graba solo 16:9.
  const canVertical = engine !== "remotion";
  const [vertical, setVertical] = useState(false);
  const formats: RecordFormat[] = vertical && canVertical ? ["16x9", "9x16"] : ["16x9"];
  const [accounts, setAccounts] = useState<string[]>([]);
  const [accountFormats, setAccountFormats] = useState<Record<string, RecordFormat>>({});

  const render = useMutation({
    mutationFn: async (draft: Draft) => {
      const result = await renderDraft(draft.draftId, {
        recorderEngine: engine,
        publishAccounts: accounts,
        formats,
        accountFormats,
      });
      return { draft, result };
    },
    onSuccess: ({ draft, result }) => {
      setSelectedId(draft.draftId);
      addJobs([
        {
          jobId: result.job_id,
          category: template.nicheId,
          label: `${template.displayName} · ${prototypeLabel(draft, template.displayName)}`,
        },
      ]);
      queryClient.invalidateQueries({ queryKey: draftKey(draft.draftId) });
      queryClient.invalidateQueries({ queryKey: draftsKey(template.id) });
    },
  });

  return {
    recordable,
    choice,
    isOriginal: choice === ORIGINAL,
    selected,
    /** El elegido está listo para grabar (preparado o reintentable). */
    ready: selected !== null && isRecordable(selected),
    select: setSelectedId,
    engines,
    engine,
    setEngine,
    canVertical,
    formats,
    vertical: vertical && canVertical,
    setVertical,
    accounts,
    setAccounts,
    accountFormats,
    setAccountFormat: (selector: string, format: RecordFormat) =>
      setAccountFormats((prev) => ({ ...prev, [selector]: format })),
    render,
  };
}

export type RecordController = ReturnType<typeof useRecordPrototype>;
