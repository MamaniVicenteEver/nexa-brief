"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Template, TemplateRequirements } from "@/features/templates/types";
import {
  createDraft,
  deleteDraft,
  prepareDraft,
  renameDraft,
  saveDraftDetails,
} from "../api/studio-service";
import {
  buildDraftRequest,
  isStudioValueComplete,
  studioValueFromDraft,
  studioValueSignature,
} from "../lib/draft-request";
import { type Draft, type DraftDetails, EMPTY_STUDIO_VALUE, type StudioValue } from "../types";
import { draftKey, draftsKey, isDraftRunning, useDraft } from "./useDraft";

/** Qué toca hacer con el prototipo: previsualizar → preparar → (detalles / grabar). */
export type PrototypeStep = "preview" | "prepare" | "prepared" | "busy" | "rendered";

function stepOf(draft: Draft | null, dirty: boolean, running: boolean): PrototypeStep {
  if (running) return "busy";
  if (!draft || dirty) return "preview";
  switch (draft.status) {
    case "preview_ready":
      return "prepare";
    case "prepared":
      return "prepared";
    case "rendered":
      return "rendered";
    case "failed":
      if (!draft.recoverable) return "preview";
      return draft.details ? "prepared" : "prepare";
    default:
      return "busy";
  }
}

/** Un prototipo del Sandbox: lo elegido (canción, medios, textos), su draft y las acciones.
 * `draftId` null = prototipo nuevo (todavía sin carpeta: se crea al previsualizar). */
export function usePrototypeEditor({
  template,
  requirements,
  draftId,
  defaultName,
  onCreated,
}: {
  template: Template;
  requirements: TemplateRequirements | undefined;
  draftId: string | null;
  defaultName: string;
  onCreated: (draftId: string) => void;
}) {
  const queryClient = useQueryClient();
  const draft = useDraft(draftId).data ?? null;
  const [value, setValue] = useState<StudioValue>(EMPTY_STUDIO_VALUE);
  const [baseSignature, setBaseSignature] = useState<string | null>(null);
  const [name, setName] = useState(defaultName);
  const [songNotes, setSongNotes] = useState("");
  const loadedFor = useRef<string | null>(null);

  // Al abrir un prototipo se carga lo que tenía elegido (una sola vez por prototipo).
  useEffect(() => {
    if (!requirements) return;
    const key = draftId ?? "new";
    if (loadedFor.current === key) return;
    if (draftId === null) {
      loadedFor.current = key;
      setValue(EMPTY_STUDIO_VALUE);
      setBaseSignature(null);
      setName(defaultName);
      setSongNotes("");
      return;
    }
    if (!draft) return;
    loadedFor.current = key;
    const restored = studioValueFromDraft(draft, requirements);
    setValue(restored);
    setSongNotes(draft.songNotes);
    setBaseSignature(studioValueSignature(template.id, requirements, restored));
    setName(draft.name || defaultName);
  }, [draftId, draft, requirements, template.id, defaultName]);

  const signature = useMemo(
    () => (requirements ? studioValueSignature(template.id, requirements, value) : null),
    [requirements, template.id, value],
  );
  const dirty = draft !== null && signature !== baseSignature;
  const refreshList = () => queryClient.invalidateQueries({ queryKey: draftsKey(template.id) });
  const store = (updated: Draft) => {
    queryClient.setQueryData(draftKey(updated.draftId), updated);
    refreshList();
  };

  const preview = useMutation({
    mutationFn: async () => {
      if (!requirements) throw new Error("requirements not loaded");
      const request = buildDraftRequest(template.id, requirements, value);
      return createDraft({ ...request, name: name.trim() || defaultName });
    },
    onSuccess: async (created) => {
      const replaced = draft;
      loadedFor.current = created.draftId;
      setBaseSignature(signature);
      store(created);
      onCreated(created.draftId);
      // Volver a previsualizar reemplaza la versión anterior del MISMO prototipo
      // (salvo que ya esté grabada: ese video vive en Biblioteca).
      if (replaced && replaced.status !== "rendered" && !isDraftRunning(replaced)) {
        await deleteDraft(replaced.draftId).catch(() => undefined);
        refreshList();
      }
    },
  });

  const prepare = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("no draft");
      return prepareDraft(draft.draftId, songNotes);
    },
    onSuccess: store,
  });

  const saveDetails = useMutation({
    mutationFn: async (details: DraftDetails) => {
      if (!draft) throw new Error("no draft");
      return saveDraftDetails(draft.draftId, details);
    },
    onSuccess: store,
  });

  const rename = useMutation({
    mutationFn: async (next: string) => {
      if (!draft) throw new Error("no draft");
      return renameDraft(draft.draftId, next);
    },
    onSuccess: store,
  });

  const running = isDraftRunning(draft) || preview.isPending || prepare.isPending;
  return {
    draft,
    value,
    setValue,
    name,
    setName,
    /** «Información de la canción» para Preparar (opcional). */
    songNotes,
    setSongNotes,
    /** Guarda el nombre (si el prototipo ya tiene carpeta y cambió). */
    commitName: () => {
      const next = name.trim();
      if (draft && next && next !== draft.name) rename.mutate(next);
    },
    dirty,
    complete: requirements ? isStudioValueComplete(requirements, value) : false,
    step: stepOf(draft, dirty, running),
    preview,
    prepare,
    saveDetails,
    error: preview.error ?? prepare.error ?? saveDetails.error ?? rename.error,
  };
}

export type PrototypeEditorController = ReturnType<typeof usePrototypeEditor>;
