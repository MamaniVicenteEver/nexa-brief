"use client";

import { useEffect, useRef } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { deleteDraftFile, readDraftFile, writeDraftFile } from "../lib/file-store";
import { readSessionValue, removeSessionValue, writeSessionValue } from "../lib/session-store";

const DEBOUNCE_MS = 400;

interface UseFormDraftOptions<T extends FieldValues> {
  /** Unique key for this form — sessionStorage key and IndexedDB key prefix.
   * Two forms sharing a key would clobber each other's drafts. */
  key: string;
  /** Field names holding a `File | undefined` — persisted in IndexedDB
   * instead of sessionStorage, since a File can't be JSON-serialized. */
  fileFields?: Path<T>[];
}

/** Auto-persists a react-hook-form's values across navigating away and back
 * within the same tab (plain fields → sessionStorage, File-valued fields →
 * IndexedDB), and restores them on mount. Generic and form-agnostic — any
 * form can reuse this by giving it a unique `key` and listing which fields
 * hold File objects; it has no idea what "create video" even means.
 *
 * Call the returned `clearDraft()` after a successful submit, so the next
 * visit doesn't get pre-filled with what was just submitted. */
export function useFormDraft<T extends FieldValues>(
  form: UseFormReturn<T>,
  { key, fileFields = [] }: UseFormDraftOptions<T>,
) {
  const didRestore = useRef(false);

  // Restores on mount. Plain fields resolve synchronously (sessionStorage);
  // files resolve async (IndexedDB) and pop in a moment later — the best
  // this storage allows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-run when `key` changes, not on every render — form/fileFields are read once here, not tracked reactively
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;

    const saved = readSessionValue<Partial<T>>(key);
    if (saved) {
      form.reset({ ...form.getValues(), ...saved });
    } else {
      // No session draft — this is a fresh tab (or the previous one
      // expired). Any file left in IndexedDB from an earlier session has no
      // matching text fields anymore, so it'd resurface out of context.
      for (const field of fileFields) {
        void deleteDraftFile(`${key}:${String(field)}`);
      }
    }

    for (const field of fileFields) {
      readDraftFile(`${key}:${String(field)}`).then((file) => {
        if (file) form.setValue(field, file as T[typeof field], { shouldDirty: true });
      });
    }
  }, [key]);

  // Persist on every change, debounced so typing doesn't hammer storage.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-subscribe when `key` changes — form/fileFields are stable for a given form instance
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fileFieldNames = new Set<string>(fileFields as string[]);

    const subscription = form.watch((values) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const plain: Record<string, unknown> = {};
        for (const [name, value] of Object.entries(values)) {
          if (!fileFieldNames.has(name)) plain[name] = value;
        }
        writeSessionValue(key, plain);

        for (const field of fileFields) {
          const value = (values as Record<string, unknown>)[field as string];
          if (value instanceof File) {
            void writeDraftFile(`${key}:${String(field)}`, value);
          } else {
            void deleteDraftFile(`${key}:${String(field)}`);
          }
        }
      }, DEBOUNCE_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [key]);

  function clearDraft(): void {
    removeSessionValue(key);
    for (const field of fileFields) {
      void deleteDraftFile(`${key}:${String(field)}`);
    }
  }

  return { clearDraft };
}
