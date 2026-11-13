"use client";

import { useQuery } from "@tanstack/react-query";
import { httpClient } from "@/infrastructure/api/http-client";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useNiches } from "@/features/create-video/hooks/useNiches";
import { useTemplateRequirements } from "@/features/templates/hooks/useTemplateRequirements";
import type { Template } from "@/features/templates/types";
import { listPromoSessions, PROMO_IDS, promoSessionsKey } from "../api/promo-service";
import { useTemplateDrafts } from "./useDraft";
import { useOriginalDraft } from "./useOriginalDraft";
import { usePrototypeEditor } from "./usePrototypeEditor";
import { useRecordPrototype } from "./useRecordPrototype";

export type StudioView = "default" | "mine";
export type StudioTab = "original" | "sandbox" | "record" | "videos";

/** Estado del Estudio de una plantilla de NodeMotion: la pestaña (Video original · Sandbox ·
 * Grabar), el prototipo abierto, la grabación y qué muestra el escenario del modal. Vive en el
 * modal (no en el sidebar) porque el iframe también depende de él.
 * Flujo: docs/investigaciones/nodemotion-sandbox-grabar-2026-10.md */
export function useTemplateStudio(template: Template, open: boolean) {
  const t = useTranslations("studio.sandbox");
  const requirements = useTemplateRequirements(template.id, open);
  const videos = useQuery({ queryKey: ["template-videos", template.id], queryFn: ({ signal }) => httpClient<TemplateVideo[]>(`/api/v1/templates/${encodeURIComponent(template.id)}/videos`, { signal }), enabled: open && template.canGenerate, refetchInterval: (q) => q.state.data?.some((video) => video.status === "rendering") ? 5000 : false });
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
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewPlaybackRequest, setPreviewPlaybackRequest] = useState(0);
  const editor = usePrototypeEditor({
    template,
    requirements: requirements.data,
    draftId: editing === "new" || editing === "__demo" ? null : editing,
    defaultName: t("defaultName", { n: prototypes.length + 1 }),
    onCreated: setEditing,
  });
  const isPromo = PROMO_IDS.has(template.id);
  const promoSessions = useQuery({ queryKey: promoSessionsKey(template.id), queryFn: ({ signal }) => listPromoSessions(template.id, signal), enabled: open && isPromo });
  const archivedDraftIds = new Set(promoSessions.data?.archived_draft_ids ?? []);
  const approvedIds = new Set((promoSessions.data?.sessions ?? []).filter((session) => session.state === "ready" && session.draft_id && !archivedDraftIds.has(session.draft_id)).map((session) => session.draft_id));
  const recorder = useRecordPrototype(template, niche, isPromo ? prototypes.filter((draft) => approvedIds.has(draft.draftId)) : prototypes, original.draft, open);

  // El escenario muestra el prototipo de la pestaña activa, si ya tiene preview.
  const stageDraft =
    tab === "sandbox"
      ? editing
        ? editor.draft
        : drafts.find((draft) => draft.draftId === previewing)
      : tab === "record"
        ? recorder.selected
        : null;
  const draftPreviewUrl = stageDraft?.previewUrl ?? null;
  const [view, setView] = useState<StudioView>("default");
  useEffect(() => {
    setView(draftPreviewUrl ? "mine" : "default");
  }, [draftPreviewUrl]);

  return {
    template,
    isOpen: open,
    isPromo,
    promoSessions,
    videos,
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
    previewPlaybackRequest,
    previewPrototype: (id: string) => {
      if (!drafts.some((draft) => draft.draftId === id && draft.previewUrl)) return;
      setPreviewPlaybackRequest((request) => request + 1);
      setPreviewing(id);
      setEditing(null);
      setTab("sandbox");
      setView("mine");
    },
    /** Una ficha sin preview no debe heredar el escenario de otra. */
    clearPrototypePreview: () => {
      setPreviewing(null);
      setEditing(null);
      setView("default");
    },
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

export interface TemplateVideo { draft_id: string; job_id: string; name: string; status: string; recoverable: boolean; created_at: string; formats: string[]; percent: number | null }
