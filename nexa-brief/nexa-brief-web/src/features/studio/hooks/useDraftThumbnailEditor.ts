"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  chooseDraftThumbnail,
  updateDraftThumbnailOption,
  uploadDraftThumbnailBackground,
} from "../api/studio-service";
import type {
  Draft,
  DraftThumbnailOption,
  DraftThumbnailOptionId,
  DraftThumbnails,
} from "../types";
import { draftKey, draftsKey } from "./useDraft";

const OPTION_IDS: DraftThumbnailOptionId[] = ["A", "B"];
const SAVE_DELAY_MS = 350;

export type DraftThumbnailManifest = DraftThumbnails & {
  options: Record<DraftThumbnailOptionId, DraftThumbnailOption>;
  artist?: string;
  draftId?: string;
};

interface PendingOption {
  value: DraftThumbnailOption;
  revision: number;
}

function optionFor(draft: Draft, option: DraftThumbnailOptionId): DraftThumbnailOption {
  const saved = draft.thumbnails?.options?.[option];
  return {
    text: saved?.text ?? draft.details?.songName ?? draft.name,
    design: saved?.design ?? { templateId: draft.templateId },
  };
}

function optionsFor(draft: Draft | null): Record<DraftThumbnailOptionId, DraftThumbnailOption> {
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
  const [options, setOptions] = useState(() => optionsFor(draft));
  const [selected, setSelected] = useState<DraftThumbnailOptionId>(
    draft?.thumbnails?.selected ?? "A",
  );
  const [editingOption, setEditingOption] = useState<DraftThumbnailOptionId>(
    draft?.thumbnails?.selected ?? "A",
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaPromise = useRef<Promise<void> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeDraftId = useRef(draftId);
  const optionsRef = useRef(options);
  const revisions = useRef<Record<DraftThumbnailOptionId, number>>({ A: 0, B: 0 });
  const dirty = useRef(new Set<DraftThumbnailOptionId>());
  const pending = useRef(new Map<DraftThumbnailOptionId, PendingOption>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushPromise = useRef<Promise<void> | null>(null);
  const desiredSelection = useRef<DraftThumbnailOptionId>(selected);
  const persistedSelection = useRef<DraftThumbnailOptionId>(selected);
  const selecting = useRef(false);
  const selectionRequested = useRef(false);
  const selectionPromise = useRef<Promise<void> | null>(null);
  const flushTextRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const setLocalOptions = useCallback(
    (next: Record<DraftThumbnailOptionId, DraftThumbnailOption>) => {
      optionsRef.current = next;
      setOptions(next);
    },
    [],
  );

  const writeCache = useCallback(
    (updated: Draft) => {
      if (updated.draftId !== activeDraftId.current) {
        client.setQueryData(draftKey(updated.draftId), updated);
        void client.invalidateQueries({ queryKey: draftsKey(updated.templateId) });
        return;
      }
      const selectedNow = desiredSelection.current;
      client.setQueryData<Draft>(draftKey(updated.draftId), (current) => {
        if (!updated.thumbnails) return updated;
        const mergedOptions = { ...current?.thumbnails?.options, ...updated.thumbnails.options };
        for (const option of OPTION_IDS) {
          if (dirty.current.has(option)) mergedOptions[option] = optionsRef.current[option];
        }
        return {
          ...current,
          ...updated,
          thumbnails: {
            ...current?.thumbnails,
            ...updated.thumbnails,
            selected: selectedNow,
            urls: { ...current?.thumbnails?.urls, ...updated.thumbnails.urls },
            options: {
              ...mergedOptions,
              ...Object.fromEntries(
                OPTION_IDS.filter((option) => dirty.current.has(option)).map((option) => [
                  option,
                  optionsRef.current[option],
                ]),
              ),
            },
          },
        };
      });
      void client.invalidateQueries({ queryKey: draftsKey(updated.templateId) });
    },
    [client],
  );

  // Reset local edits only when switching drafts; same-draft server updates merge below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: draft identity intentionally owns this reset.
  useEffect(() => {
    activeDraftId.current = draftId;
    setLocalOptions(optionsFor(draft));
    const nextSelected = draft?.thumbnails?.selected ?? "A";
    setSelected(nextSelected);
    setEditingOption(nextSelected);
    desiredSelection.current = nextSelected;
    persistedSelection.current = nextSelected;
    pending.current.clear();
    dirty.current.clear();
    revisions.current = { A: 0, B: 0 };
    setPendingCount(0);
    setError(null);
    // A new draft gets an independent editor queue.
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    flushPromise.current = null;
    selectionPromise.current = null;
    selectionRequested.current = false;
    selecting.current = false;
    setIsSaving(false);
    setIsSelecting(false);
    setIsUploading(false);
    mediaPromise.current = null;
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (pending.current.size > 0) void flushTextRef.current().catch(() => undefined);
    };
  }, [draftId, setLocalOptions]);

  useEffect(() => {
    if (!draft || pending.current.size > 0 || dirty.current.size > 0) return;
    const remoteOptions = optionsFor(draft);
    setLocalOptions(remoteOptions);
    if (!selectionRequested.current) {
      const remoteSelected = draft.thumbnails?.selected ?? "A";
      setSelected(remoteSelected);
      desiredSelection.current = remoteSelected;
      persistedSelection.current = remoteSelected;
    }
  }, [draft, draft?.thumbnails, setLocalOptions]);

  const publishPendingCount = useCallback(() => {
    setPendingCount(pending.current.size + dirty.current.size);
  }, []);

  const flushText = useCallback((): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (flushPromise.current) return flushPromise.current;
    if (!draftId || pending.current.size === 0) {
      if (dirty.current.size === 0) setPendingCount(0);
      return Promise.resolve();
    }

    const run = async () => {
      setIsSaving(true);
      setError(null);
      try {
        while (activeDraftId.current === draftId && pending.current.size > 0) {
          const batch = [...pending.current.entries()];
          for (const [option] of batch) pending.current.delete(option);
          publishPendingCount();
          for (const [index, [option, item]] of batch.entries()) {
            try {
              const updated = await updateDraftThumbnailOption(draftId, option, item.value);
              if (activeDraftId.current !== draftId) {
                writeCache(updated);
                continue;
              }
              if (revisions.current[option] === item.revision) {
                dirty.current.delete(option);
              }
              writeCache(updated);
            } catch (requestError) {
              if (activeDraftId.current === draftId) {
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
        if (activeDraftId.current === draftId) setIsSaving(false);
      }
    };

    let promise: Promise<void>;
    promise = run().finally(() => {
      if (flushPromise.current === promise) flushPromise.current = null;
      if (activeDraftId.current === draftId) publishPendingCount();
      else if (pending.current.size > 0) {
        void Promise.resolve().then(() => flushTextRef.current().catch(() => undefined));
      }
    });
    flushPromise.current = promise;
    return promise;
  }, [draftId, publishPendingCount, writeCache]);

  useEffect(() => {
    flushTextRef.current = flushText;
  }, [flushText]);

  const updateOption = useCallback(
    (option: DraftThumbnailOptionId, patch: Partial<DraftThumbnailOption>) => {
      const next = { ...optionsRef.current, [option]: { ...optionsRef.current[option], ...patch } };
      setLocalOptions(next);
      if (!draftId || !draft?.thumbnails) return;
      const revision = ++revisions.current[option];
      dirty.current.add(option);
      pending.current.set(option, { value: next[option], revision });
      setError(null);
      publishPendingCount();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flushText().catch(() => undefined);
      }, SAVE_DELAY_MS);
    },
    [draft?.thumbnails, draftId, flushText, publishPendingCount, setLocalOptions],
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
          if (activeDraftId.current !== draftId) return;
          const design = optionsRef.current[option].design ?? {};
          const background = (design.background ?? {}) as Record<string, unknown>;
          updateOption(option, {
            design: {
              ...design,
              background: { ...background, kind: "image", asset: result.asset },
            },
          });
        } catch (uploadError) {
          if (activeDraftId.current === draftId)
            setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
          throw uploadError;
        } finally {
          if (activeDraftId.current === draftId) setIsUploading(false);
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
    [draftId, editingOption, updateOption],
  );

  const runSelectionQueue = useCallback((): Promise<void> => {
    if (selectionPromise.current) return selectionPromise.current;
    if (!draftId || !draft?.thumbnails) return Promise.resolve();
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
          activeDraftId.current === draftId &&
          persistedSelection.current !== desiredSelection.current
        ) {
          const target = desiredSelection.current;
          const updated = await chooseDraftThumbnail(draftId, target);
          if (activeDraftId.current !== draftId) {
            writeCache(updated);
            return;
          }
          persistedSelection.current = target;
          writeCache(updated);
        }
        if (activeDraftId.current === draftId) selectionRequested.current = false;
      } catch (selectionError) {
        setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
        throw selectionError;
      } finally {
        if (activeDraftId.current === draftId) {
          selecting.current = false;
          setIsSelecting(false);
          selectionPromise.current = null;
        }
      }
    };
    selectionPromise.current = run();
    return selectionPromise.current;
  }, [draft?.thumbnails, draftId, flushText, writeCache]);

  const choose = useCallback(
    (option: DraftThumbnailOptionId) => {
      setEditingOption(option);
      desiredSelection.current = option;
      selectionRequested.current = true;
      setSelected(option);
      client.setQueryData<Draft>(draftKey(draftId), (current) =>
        current?.thumbnails
          ? { ...current, thumbnails: { ...current.thumbnails, selected: option } }
          : current,
      );
      publishPendingCount();
      return runSelectionQueue();
    },
    [client, draftId, publishPendingCount, runSelectionQueue],
  );

  const flush = useCallback(async () => {
    await mediaPromise.current;
    await flushText();
    await runSelectionQueue();
    await flushText();
  }, [flushText, runSelectionQueue]);

  const manifest: DraftThumbnailManifest = {
    draftId: draftId ?? undefined,
    fingerprint: draft?.thumbnails?.fingerprint ?? "",
    selected,
    artist: draft?.details?.artist ?? "",
    urls: draft?.thumbnails?.urls ?? {},
    options,
  };

  return {
    selected,
    editingOption,
    editOption: setEditingOption,
    options,
    manifest,
    text: options[editingOption].text,
    setText: (text: string) => setText(editingOption, text),
    setOptionText: setText,
    setDesign,
    uploadBackground,
    isUploading,
    choose,
    flush,
    isSaving: error === null && (isSaving || isUploading || pendingCount > 0),
    isSelecting,
    hasError: error !== null,
    error,
    retry: flush,
  };
}

export type DraftThumbnailEditor = ReturnType<typeof useDraftThumbnailEditor>;
