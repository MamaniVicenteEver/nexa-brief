import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  createTemplatePreview,
  getPreviewStatus,
  type TemplatePreviewSelections,
} from "../api/templates-service";

/** Dispara un preview fire-and-forget y pollea su estado hasta terminar.
 * Terminal acá es propio del preview (html_generated/failed) — NO reusa
 * `isTerminalStage` de create-video/stage.ts, que es para videos reales
 * (packaged/published/failed) y nunca marcaría un preview como terminado. */
export function useTemplatePreview(templateId: string) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  const trigger = useMutation({
    mutationFn: (selections: TemplatePreviewSelections) =>
      createTemplatePreview(templateId, selections),
    onSuccess: (handle) => setPreviewId(handle.previewId),
  });

  const status = useQuery({
    queryKey: ["preview-status", previewId],
    queryFn: ({ signal }) => getPreviewStatus(previewId as string, signal),
    enabled: previewId !== null,
    refetchInterval: (query) => (query.state.data?.isTerminal ? false : 2000),
    retry: false,
  });

  return {
    triggerPreview: trigger.mutate,
    isTriggering: trigger.isPending,
    previewId,
    status: status.data,
  };
}
