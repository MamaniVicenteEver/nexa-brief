import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent } from "@/features/realtime";
import { getDraft, listDrafts } from "../api/studio-service";
import type { Draft, DraftStatus } from "../types";

const RUNNING: DraftStatus[] = ["previewing", "preparing", "rendering"];

export function draftKey(draftId: string | null) {
  return ["draft", draftId] as const;
}

export function draftsKey(templateId: string) {
  return ["drafts", templateId] as const;
}

export function isDraftRunning(draft: Draft | undefined | null): boolean {
  return Boolean(draft && RUNNING.includes(draft.status));
}

/** Estado en vivo de un draft: el evento `draft_changed` dispara un refetch al
 * instante, y mientras corre hay un polling lento de respaldo por si el
 * WebSocket se cortó (el evento no trae preview_url ni errores, por eso se
 * vuelve a pedir el draft entero en vez de parchear la caché). */
export function useDraft(draftId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: draftKey(draftId),
    queryFn: ({ signal }) => getDraft(draftId as string, signal),
    enabled: draftId !== null,
    refetchInterval: (q) => (isDraftRunning(q.state.data) ? 4_000 : false),
  });

  useRealtimeEvent<{ draft_id: string }>("draft_changed", (data) => {
    if (draftId && data?.draft_id === draftId) {
      queryClient.invalidateQueries({ queryKey: draftKey(draftId) });
    }
  });

  return query;
}

/** Prototipos de la plantilla (el más nuevo primero), en vivo: la lista del Sandbox
 * y el selector de Grabar muestran el estado de cada uno. */
export function useTemplateDrafts(templateId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: draftsKey(templateId),
    queryFn: ({ signal }) => listDrafts(templateId, signal),
    enabled,
    staleTime: 0,
    retry: 1,
    refetchInterval: (q) => (q.state.data?.some(isDraftRunning) ? 5_000 : false),
  });

  useRealtimeEvent<{ draft_id: string }>("draft_changed", () => {
    if (enabled) queryClient.invalidateQueries({ queryKey: draftsKey(templateId) });
  });

  return query;
}
