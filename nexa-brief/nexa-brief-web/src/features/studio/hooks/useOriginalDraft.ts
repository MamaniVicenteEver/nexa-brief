"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Template } from "@/features/templates/types";
import { createOriginalDraft, saveDraftDetails } from "../api/studio-service";
import type { Draft, DraftDetails } from "../types";
import { draftKey, draftsKey } from "./useDraft";

/** El «Video original» de la plantilla: su prototipo (si ya existe), cómo crearlo/prepararlo y
 * guardar sus textos de publicación. El backend importa la canción, letra y fondo de la plantilla. */
export function useOriginalDraft(template: Template, drafts: Draft[]) {
  const queryClient = useQueryClient();
  // El más nuevo que siga vigente; si no, el último grabado (para ver sus textos).
  const draft =
    drafts.find((d) => d.original && d.status !== "rendered") ??
    drafts.find((d) => d.original) ??
    null;
  const store = (updated: Draft) => {
    queryClient.setQueryData(draftKey(updated.draftId), updated);
    queryClient.invalidateQueries({ queryKey: draftsKey(template.id) });
  };

  // Con información de la canción, prepara (o vuelve a preparar) usándola.
  const ensure = useMutation({
    mutationFn: (songNotes: string = "") => createOriginalDraft(template.id, songNotes),
    onSuccess: store,
  });
  const saveDetails = useMutation({
    mutationFn: async (details: DraftDetails) => {
      if (!draft) throw new Error("no original");
      return saveDraftDetails(draft.draftId, details);
    },
    onSuccess: store,
  });

  return { draft, ensure, saveDetails };
}

export type OriginalController = ReturnType<typeof useOriginalDraft>;
