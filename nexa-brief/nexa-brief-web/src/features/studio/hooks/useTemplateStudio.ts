"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useNiches } from "@/features/create-video/hooks/useNiches";
import { useTemplateRequirements } from "@/features/templates/hooks/useTemplateRequirements";
import type { Template } from "@/features/templates/types";
import { useTemplateDrafts } from "./useDraft";
import { useOriginalDraft } from "./useOriginalDraft";
import { usePrototypeEditor } from "./usePrototypeEditor";
import { useRecordPrototype } from "./useRecordPrototype";

export type StudioView = "default" | "mine";
export type StudioTab = "original" | "sandbox" | "record";

/** Estado del Estudio de una plantilla de NodeMotion: la pestaña (Video original · Sandbox ·
 * Grabar), el prototipo abierto, la grabación y qué muestra el escenario del modal. Vive en el
 * modal (no en el sidebar) porque el iframe también depende de él.
 * Flujo: docs/investigaciones/nodemotion-sandbox-grabar-2026-10.md */
export function useTemplateStudio(template: Template, open: boolean) {
  const t = useTranslations("studio.sandbox");
  const requirements = useTemplateRequirements(template.id, open);
  const { data: niches } = useNiches();
  const niche = niches?.find((n) => n.id === template.nicheId);
  const draftsQuery = useTemplateDrafts(template.id, open && template.canGenerate);
  const drafts = draftsQuery.data ?? [];
  // El «Video original» vive aparte: no es un prototipo del Sandbox.
  const prototypes = drafts.filter((d) => !d.original);
  const original = useOriginalDraft(template, drafts);

  const [tab, setTab] = useState<StudioTab>("original");
  // Prototipo abierto en el Sandbox: su id, "new" (sin carpeta todavía) o null (la lista).
  const [editing, setEditing] = useState<string | null>(null);
  const editor = usePrototypeEditor({
    template,
    requirements: requirements.data,
    draftId: editing === "new" ? null : editing,
    defaultName: t("defaultName", { n: prototypes.length + 1 }),
    onCreated: setEditing,
  });
  const recorder = useRecordPrototype(template, niche, prototypes, original.draft);

  // El escenario muestra el prototipo de la pestaña activa, si ya tiene preview.
  const stageDraft =
    tab === "sandbox" && editing ? editor.draft : tab === "record" ? recorder.selected : null;
  const draftPreviewUrl = stageDraft?.previewUrl ?? null;
  const [view, setView] = useState<StudioView>("default");
  useEffect(() => {
    setView(draftPreviewUrl ? "mine" : "default");
  }, [draftPreviewUrl]);

  return {
    template,
    niche,
    requirements,
    prototypes,
    original,
    draftsLoading: draftsQuery.isLoading,
    tab,
    setTab,
    editing,
    openPrototype: (id: string | "new") => {
      setEditing(id);
      setTab("sandbox");
    },
    closePrototype: () => setEditing(null),
    /** Lleva un prototipo preparado a la pestaña Grabar. */
    recordPrototype: (id: string) => {
      recorder.select(id);
      setTab("record");
    },
    editor,
    recorder,
    view,
    setView,
    /** URL del preview del prototipo en pantalla (Mi versión) si está disponible. */
    draftPreviewUrl,
  };
}

export type TemplateStudioController = ReturnType<typeof useTemplateStudio>;
