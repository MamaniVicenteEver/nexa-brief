import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { Draft, StudioValue } from "@/features/studio";
import type { TemplateRequirements } from "@/features/templates/types";
import {
  type AiProgress,
  createDraftsInSequence,
  resolveMediaWithAi,
} from "../api/create-flow-service";
import { buildCreateFlowDraftRequest, unfilledSlots } from "../lib/draft-flow";
import type { CreateVideoFormValues } from "../schema";

export type CreateFlowProgress =
  | { phase: "idle" }
  | { phase: "ai"; ai: AiProgress }
  | { phase: "creating"; done: number; total: number };

export interface CreateFlowInput {
  templateId: string;
  requirements: TemplateRequirements;
  content: StudioValue;
  values: CreateVideoFormValues;
}

export interface CreateFlowResult {
  drafts: Draft[];
  /** Contenido final (con lo que haya completado la IA), para dejarlo en el form. */
  content: StudioValue;
  /** Si algún draft no se pudo crear: los ya creados igual corren. */
  error: unknown | null;
}

/** "Generar" en un paso sobre drafts: si hay brief y lugares vacíos, primero
 * la IA arma e importa los medios; después un POST /drafts con auto_render por
 * video pedido (cada uno previsualiza y se graba solo). */
export function useCreateFlow() {
  const [progress, setProgress] = useState<CreateFlowProgress>({ phase: "idle" });

  const mutation = useMutation({
    mutationFn: async ({
      templateId,
      requirements,
      content,
      values,
    }: CreateFlowInput): Promise<CreateFlowResult> => {
      let finalContent = content;
      if (content.brief.trim() && unfilledSlots(requirements, content).length > 0) {
        finalContent = await resolveMediaWithAi(templateId, requirements, content, (p) =>
          setProgress({ phase: "ai", ai: p }),
        );
      }

      const total = Math.max(1, values.quantity || 1);
      setProgress({ phase: "creating", done: 0, total });
      const request = buildCreateFlowDraftRequest(templateId, requirements, finalContent, values);
      let done = 0;
      const { drafts, error } = await createDraftsInSequence(request, total, () => {
        done += 1;
        setProgress({ phase: "creating", done, total });
      });
      // Ninguno creado: es un error de verdad (lo maneja onError).
      if (drafts.length === 0 && error) throw error;
      return { drafts, content: finalContent, error };
    },
    onSettled: () => setProgress({ phase: "idle" }),
  });

  return { ...mutation, progress };
}
