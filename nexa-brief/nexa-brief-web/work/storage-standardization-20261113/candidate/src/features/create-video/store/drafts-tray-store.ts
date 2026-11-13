import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Un video de "Crear video" que todavía está en la etapa de preview del
 * draft: recién al empezar a grabar el backend le asigna el job_id de
 * Biblioteca (GET /videos/jobs/{id} da 404 antes). Hasta entonces la bandeja
 * lo sigue por draft_id; cuando aparece el job_id pasa a `useJobsTrayStore`
 * y sale de acá (ver DraftTrayCard). */
export interface TrackedDraft {
  draftId: string;
  category: string;
}

const MAX_TRACKED_DRAFTS = 20;

interface DraftsTrayState {
  drafts: TrackedDraft[];
  addDrafts: (drafts: TrackedDraft[]) => void;
  removeDraft: (draftId: string) => void;
}

/** Misma persistencia que useJobsTrayStore (sessionStorage, rehidratada a
 * mano por JobsTray): navegar a otra página no pierde los que están
 * previsualizando. Vive en create-video porque solo este flujo la llena. */
export const useDraftsTrayStore = create<DraftsTrayState>()(
  persist(
    (set) => ({
      drafts: [],
      addDrafts: (newDrafts) =>
        set((state) => {
          const existing = new Set(state.drafts.map((d) => d.draftId));
          const combined = [...state.drafts, ...newDrafts.filter((d) => !existing.has(d.draftId))];
          return { drafts: combined.slice(-MAX_TRACKED_DRAFTS) };
        }),
      removeDraft: (draftId) =>
        set((state) => ({ drafts: state.drafts.filter((d) => d.draftId !== draftId) })),
    }),
    {
      name: "nexa-drafts-tray",
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
    },
  ),
);
