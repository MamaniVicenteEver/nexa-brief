"use client";

import { Play } from "lucide-react";
import type { TemplateStudioController } from "../../hooks/useTemplateStudio";

/** Play changes the stage only; opening the session remains a separate action. */
export function PromoPreviewButton({ studio, draftId }: { studio: TemplateStudioController; draftId: string | null | undefined }) {
  const draft = studio.prototypes.find((item) => item.draftId === draftId) ??
    (studio.original?.draft?.draftId === draftId ? studio.original.draft : undefined);
  if (!draftId || !draft?.previewUrl) return null;
  return (
    <button type="button" aria-label={`Reproducir ${draft.original ? "Demo" : draft.name || "prototipo"}`} title="Reproducir vista previa"
      className="inline-flex items-center gap-1 text-xs font-semibold" onClick={() => studio.previewPrototype(draftId)}>
      <Play className="size-3" aria-hidden="true" /> Play
    </button>
  );
}
