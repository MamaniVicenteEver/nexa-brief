"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNiches } from "@/features/create-video/hooks/useNiches";
import { useTemplateRequirements } from "@/features/templates/hooks/useTemplateRequirements";
import type { Template } from "@/features/templates/types";
import { createDraft, renderDraft } from "../api/studio-service";
import {
  buildDraftRequest,
  isStudioValueComplete,
  studioValueFromDraft,
  studioValueSignature,
} from "../lib/draft-request";
import { EMPTY_STUDIO_VALUE, type RenderOptions, type StudioValue } from "../types";
import { draftKey, isDraftRunning, useDraft, useTemplateDrafts } from "./useDraft";

export type StudioView = "default" | "mine";

/** "preview" = el botón principal previsualiza; "render" = graba el draft. */
export type StudioPrimaryAction = "preview" | "render" | "busy";

/** Estado completo del Estudio de una plantilla: lo elegido, el draft en
 * curso y qué muestra el escenario del modal. Vive en TemplateCard (no en el
 * sidebar) porque el iframe del modal también depende de él. */
export function useTemplateStudio(template: Template, open: boolean) {
  const queryClient = useQueryClient();
  const requirements = useTemplateRequirements(template.id, open);
  const { data: niches } = useNiches();
  const niche = niches?.find((n) => n.id === template.nicheId);
  const drafts = useTemplateDrafts(template.id, open && template.canGenerate);

  const [value, setValue] = useState<StudioValue>(EMPTY_STUDIO_VALUE);
  const [renderOptions, setRenderOptions] = useState<RenderOptions>({ publishAccounts: [] });
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSignature, setDraftSignature] = useState<string | null>(null);
  const [view, setView] = useState<StudioView>("default");
  const restoredRef = useRef(false);

  const draftQuery = useDraft(draftId);
  const draft = draftQuery.data ?? null;

  // Al abrir por primera vez retoma el último draft de esta plantilla que
  // siga vigente (en curso o listo para grabar), con lo que se había elegido.
  useEffect(() => {
    if (restoredRef.current || !requirements.data || !drafts.isFetched) return;
    restoredRef.current = true;
    const latest = drafts.data?.find(
      (d) => d.status !== "rendered" && (d.status !== "failed" || d.recoverable),
    );
    if (!latest) return;
    const restored = studioValueFromDraft(latest, requirements.data);
    setValue(restored);
    setDraftId(latest.draftId);
    setDraftSignature(studioValueSignature(template.id, requirements.data, restored));
    queryClient.setQueryData(draftKey(latest.draftId), latest);
  }, [requirements.data, drafts.isFetched, drafts.data, template.id, queryClient]);

  // Apenas el preview queda listo, el escenario pasa a "Mi versión".
  const readyUrl = draft?.status === "preview_ready" ? draft.previewUrl : null;
  useEffect(() => {
    if (readyUrl) setView("mine");
  }, [readyUrl]);

  const signature = useMemo(
    () => (requirements.data ? studioValueSignature(template.id, requirements.data, value) : null),
    [requirements.data, template.id, value],
  );
  const dirty = draft !== null && signature !== draftSignature;

  const preview = useMutation({
    mutationFn: async () => {
      if (!requirements.data) throw new Error("requirements not loaded");
      return createDraft(buildDraftRequest(template.id, requirements.data, value));
    },
    onSuccess: (created) => {
      queryClient.setQueryData(draftKey(created.draftId), created);
      setDraftId(created.draftId);
      setDraftSignature(signature);
      setView("default");
    },
  });

  const render = useMutation({
    mutationFn: async () => {
      if (!draftId) throw new Error("no draft");
      return renderDraft(draftId, renderOptions);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: draftKey(draftId) }),
  });

  const complete = requirements.data ? isStudioValueComplete(requirements.data, value) : false;
  const running = isDraftRunning(draft) || preview.isPending || render.isPending;
  const canRender =
    draft !== null &&
    !dirty &&
    (draft.status === "preview_ready" || (draft.status === "failed" && draft.recoverable));

  const primaryAction: StudioPrimaryAction = running ? "busy" : canRender ? "render" : "preview";

  return {
    template,
    niche,
    requirements,
    value,
    setValue,
    renderOptions,
    setRenderOptions,
    draft,
    dirty,
    complete,
    view,
    setView,
    /** URL del preview del draft (Mi versión) si está disponible. */
    draftPreviewUrl: draft?.previewUrl ?? null,
    primaryAction,
    preview,
    render,
    runPrimary: () => (primaryAction === "render" ? render.mutate() : preview.mutate()),
  };
}

export type TemplateStudioController = ReturnType<typeof useTemplateStudio>;
