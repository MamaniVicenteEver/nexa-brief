"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  chooseDraftThumbnail,
  updateDraftThumbnailOption,
  uploadDraftThumbnailBackground,
} from "../api/studio-service";
import {
  restoreThumbnailEdits,
  serializeThumbnailEdits,
  thumbnailLocalEdits,
} from "../services/thumbnail-local-edits";
import type {
  Draft,
  DraftThumbnailOption,
  DraftThumbnailOptionId,
  DraftThumbnails,
} from "../types";
import { draftKey, draftsKey } from "./useDraft";

const OPTION_IDS: DraftThumbnailOptionId[] = ["A", "B"];

export type DraftThumbnailManifest = DraftThumbnails & {
  options: Record<DraftThumbnailOptionId, DraftThumbnailOption>;
  artist?: string;
  draftId?: string;
};

interface PendingOption {
  value: DraftThumbnailOption;
  revision: number;
}

function manifestFor(draft: Draft | null): DraftThumbnails | null {
  return draft?.thumbnails ?? null;
}

function optionFor(
  draft: Draft,
  option: DraftThumbnailOptionId,
): DraftThumbnailOption {
  const saved = manifestFor(draft)?.options?.[option];
  return {
    text: saved?.text ?? draft.details?.songName ?? draft.name,
    design: saved?.design ?? { templateId: draft.templateId },
  };
}

function optionsFor(
  draft: Draft | null,
): Record<DraftThumbnailOptionId, DraftThumbnailOption> {
  if (!draft) return { A: { text: "", design: {} }, B: { text: "", design: {} } };
  return { A: optionFor(draft, "A"), B: optionFor(draft, "B") };
}

/**
 * Mantiene el manifest de miniaturas optimista mientras escribe y serializa los
 * guardados por opción. flush() permite que Grabar espere al último texto.
 */
export function useDraftThumbnailEditor(draft: Draft | null) {
  const client = useQueryClient();
  const draftId = draft?.draftId ?? null;
  const sourceManifest = manifestFor(draft);
  const localKey = draftId;
  const editorScope = localKey;
  const [options, setOptions] = useState(() => optionsFor(draft));
  const [selected, setSelected] = useState<DraftThumbnailOptionId>(sourceManifest?.selected ?? "A");
  const [editingOption, setEditingOption] = useState<DraftThumbnailOptionId>(
    sourceManifest?.selected ?? "A",
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isLocalStored, setIsLocalStored] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaPromise = useRef<Promise<void> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeDraftId = useRef(draftId);
  const activeEditorScope = useRef(editorScope);
  const optionsRef = useRef(options);
  const revisions = useRef<Record<DraftThumbnailOptionId, number>>({ A: 0, B: 0 });
  const dirty = useRef(new Set<DraftThumbnailOptionId>());
  const pending = useRef(new Map<DraftThumbnailOptionId, PendingOption>());
  const flushPromise = useRef<Promise<void> | null>(null);
  const desiredSelection = useRef<DraftThumbnailOptionId>(selected);
  const persistedSelection = useRef<DraftThumbnailOptionId>(selected);
  const selecting = useRef(false);
  const selectionRequested = useRef(false);
  const selectionPromise = useRef<Promise<void> | null>(null);

  const setLocalOptions = useCallback(
    (next: Record<DraftThumbnailOptionId, DraftThumbnailOption>) => {
      optionsRef.current = next;
      setOptions(next);
    },
    [],
  );

  const writeCache = useCallback(
    (updated: Draft) => {
      if (
        updated.draftId !== activeDraftId.current ||
        activeEditorScope.current !== editorScope
      ) {
        client.setQueryData<Draft>(draftKey(updated.draftId), (current) => ({
          ...current,
          ...updated,
        }));
        void client.invalidateQueries({ queryKey: draftsKey(updated.templateId) });
        return;
      }
      client.setQueryData<Draft>(draftKey(updated.draftId), (current) => ({
        ...current,
        ...updated,
        thumbnails: updated.thumbnails ?? current?.thumbnails,
      }));
      void client.invalidateQueries({ queryKey: draftsKey(updated.templateId) });
    },
    [client, editorScope],
  );

  // Cada destino tiene su cola y respaldo local; cambiarlo no pisa el estado A/B legacy.
  // biome-ignore lint/correctness/useExhaustiveDependencies: el alcance del editor controla este reset.
  useEffect(() => {
    activeDraftId.current = draftId;
    activeEditorScope.current = editorScope;
    const cached = localKey ? thumbnailLocalEdits.get(localKey) : null;
    const nextOptions = restoreThumbnailEdits(optionsFor(draft), cached);
    setLocalOptions(nextOptions);
    const remoteSelected = sourceManifest?.selected ?? "A";
    const nextSelected =
      cached?.selected === "B" ? "B" : cached?.selected === "A" ? "A" : remoteSelected;
    setSelected(nextSelected);
    setEditingOption(cached?.editing === "B" ? "B" : cached?.editing === "A" ? "A" : nextSelected);
    desiredSelection.current = nextSelected;
    persistedSelection.current = remoteSelected;
    pending.current.clear();
    dirty.current.clear();
    revisions.current = { A: 0, B: 0 };
    for (const option of OPTION_IDS) {
      if (cached?.options?.[option]) {
        dirty.current.add(option);
        pending.current.set(option, { value: nextOptions[option], revision: 0 });
      }
    }
    setPendingCount(pending.current.size);
    setError(null);
    flushPromise.current = null;
    selectionPromise.current = null;
    selectionRequested.current = nextSelected !== remoteSelected;
    selecting.current = false;
    setIsSaving(false);
    setIsSelecting(false);
    setIsUploading(false);
    mediaPromise.current = null;
  }, [editorScope, setLocalOptions]);

  useEffect(() => {
    if (!draft || pending.current.size > 0 || dirty.current.size > 0) return;
    const remoteOptions = optionsFor(draft);
    setLocalOptions(remoteOptions);
    if (!selectionRequested.current) {
      const remoteSelected = sourceManifest?.selected ?? "A";
      setSelected(remoteSelected);
      desiredSelection.current = remoteSelected;
      persistedSelection.current = remoteSelected;
    }
  }, [draft, sourceManifest, setLocalOptions]);

  const publishPendingCount = useCallback(() => {
    setPendingCount(pending.current.size + dirty.current.size);
  }, []);

  const flushText = useCallback((): Promise<void> => {
    if (flushPromise.current) return flushPromise.current;
    if (!draftId || pending.current.size === 0) {
      if (dirty.current.size === 0) setPendingCount(0);
      return Promise.resolve();
    }

    const run = async () => {
      setIsSaving(true);
      setError(null);
      try {
        while (activeEditorScope.current === editorScope && pending.current.size > 0) {
          const batch = [...pending.current.entries()];
          for (const [option] of batch) pending.current.delete(option);
          publishPendingCount();
          for (const [index, [option, item]] of batch.entries()) {
            try {
              const updated = await updateDraftThumbnailOption(draftId, option, item.value);
              if (activeEditorScope.current !== editorScope) {
                writeCache(updated);
                continue;
              }
              if (revisions.current[option] === item.revision) {
                dirty.current.delete(option);
              }
              writeCache(updated);
            } catch (requestError) {
              if (activeEditorScope.current === editorScope) {
                for (const [remainingOption, remainingItem] of batch.slice(index)) {
                  if (!pending.current.has(remainingOption)) {
                    pending.current.set(remainingOption, remainingItem);
                  }
                }
                publishPendingCount();
                throw requestError;
              }
            }
          }
        }
        publishPendingCount();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : String(saveError));
        throw saveError;
      } finally {
        if (activeEditorScope.current === editorScope) setIsSaving(false);
      }
    };

    let promise: Promise<void>;
    promise = run().finally(() => {
      if (flushPromise.current === promise) flushPromise.current = null;
      if (activeEditorScope.current === editorScope) publishPendingCount();
    });
    flushPromise.current = promise;
    return promise;
  }, [draftId, editorScope, publishPendingCount, writeCache]);

  const updateOption = useCallback(
    (option: DraftThumbnailOptionId, patch: Partial<DraftThumbnailOption>) => {
      const next = { ...optionsRef.current, [option]: { ...optionsRef.current[option], ...patch } };
      setLocalOptions(next);
      if (!draftId || !sourceManifest) return;
      const revision = ++revisions.current[option];
      dirty.current.add(option);
      pending.current.set(option, { value: next[option], revision });
      setError(null);
      publishPendingCount();
      setIsLocalStored(
        thumbnailLocalEdits.set(
          localKey ?? draftId,
          serializeThumbnailEdits(next, dirty.current, desiredSelection.current, editingOption),
        ),
      );
    },
    [draftId, editingOption, localKey, publishPendingCount, setLocalOptions, sourceManifest],
  );
  const setText = useCallback(
    (option: DraftThumbnailOptionId, text: string) => {
      updateOption(option, { text });
    },
    [updateOption],
  );
  const setDesign = useCallback(
    (patch: Record<string, unknown>) => {
      updateOption(editingOption, {
        design: { ...optionsRef.current[editingOption].design, ...patch },
      });
    },
    [editingOption, updateOption],
  );
  const uploadBackground = useCallback(
    (file: File) => {
      if (!draftId) return Promise.resolve();
      const option = editingOption;
      setIsUploading(true);
      setError(null);
      const promise = (async () => {
        try {
          const result = await uploadDraftThumbnailBackground(draftId, file);
          if (activeEditorScope.current !== editorScope) return;
          const design = optionsRef.current[option].design ?? {};
          const background = (design.background ?? {}) as Record<string, unknown>;
          updateOption(option, {
            design: {
              ...design,
              background: { ...background, kind: "image", asset: result.asset },
            },
          });
        } catch (uploadError) {
          if (activeEditorScope.current === editorScope)
            setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
          throw uploadError;
        } finally {
          if (activeEditorScope.current === editorScope) setIsUploading(false);
        }
      })();
      mediaPromise.current = promise;
      promise
        .finally(() => {
          if (mediaPromise.current === promise) mediaPromise.current = null;
        })
        .catch(() => undefined);
      return promise;
    },
    [draftId, editingOption, editorScope, updateOption],
  );

  const runSelectionQueue = useCallback((): Promise<void> => {
    if (selectionPromise.current) return selectionPromise.current;
    if (!draftId || !sourceManifest) return Promise.resolve();
    if (persistedSelection.current === desiredSelection.current) {
      selectionRequested.current = false;
      return Promise.resolve();
    }

    selectionRequested.current = true;
    const run = async () => {
      selecting.current = true;
      setIsSelecting(true);
      setError(null);
      try {
        await flushText();
        while (
          activeEditorScope.current === editorScope &&
          persistedSelection.current !== desiredSelection.current
        ) {
          const target = desiredSelection.current;
          const updated = await chooseDraftThumbnail(draftId, target);
          if (activeEditorScope.current !== editorScope) {
            writeCache(updated);
            return;
          }
          persistedSelection.current = target;
          writeCache(updated);
        }
        if (activeEditorScope.current === editorScope) selectionRequested.current = false;
      } catch (selectionError) {
        setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
        throw selectionError;
      } finally {
        if (activeEditorScope.current === editorScope) {
          selecting.current = false;
          setIsSelecting(false);
          selectionPromise.current = null;
        }
      }
    };
    selectionPromise.current = run();
    return selectionPromise.current;
  }, [draftId, editorScope, flushText, sourceManifest, writeCache]);

  const choose = useCallback(
    (option: DraftThumbnailOptionId) => {
      setEditingOption(option);
      desiredSelection.current = option;
      selectionRequested.current = true;
      setSelected(option);
      client.setQueryData<Draft>(draftKey(draftId), (current) => {
        return current?.thumbnails
          ? { ...current, thumbnails: { ...current.thumbnails, selected: option } }
          : current;
      });
      publishPendingCount();
      if (draftId)
        setIsLocalStored(
          thumbnailLocalEdits.set(
            localKey ?? draftId,
            serializeThumbnailEdits(optionsRef.current, dirty.current, option, option),
          ),
        );
      return Promise.resolve();
    },
    [client, draftId, editorScope, localKey, publishPendingCount],
  );

  const flush = useCallback(async () => {
    await mediaPromise.current;
    await flushText();
    await runSelectionQueue();
    await flushText();
    if (draftId) thumbnailLocalEdits.remove(localKey ?? draftId);
  }, [draftId, flushText, localKey, runSelectionQueue]);

  const manifest: DraftThumbnailManifest = {
    draftId: draftId ?? undefined,
    fingerprint: sourceManifest?.fingerprint ?? "",
    selected,
    artist: draft?.details?.artist ?? "",
    urls: sourceManifest?.urls ?? {},
    options,
  };

  return {
    selected,
    editingOption,
    editOption: setEditingOption,
    options,
    manifest,
    hasManifest: sourceManifest !== null,
    hasSelectedCapture: Boolean(sourceManifest?.urls?.[selected]),
    text: options[editingOption].text,
    setText: (text: string) => setText(editingOption, text),
    setOptionText: setText,
    setDesign,
    uploadBackground,
    isUploading,
    choose,
    flush,
    isLocalStored,
    hasLocalChanges: pendingCount > 0 || selected !== persistedSelection.current,
    isSaving: error === null && (isSaving || isUploading),
    isSelecting,
    hasError: error !== null,
    error,
    retry: flush,
  };
}

export type DraftThumbnailEditor = ReturnType<typeof useDraftThumbnailEditor>;
