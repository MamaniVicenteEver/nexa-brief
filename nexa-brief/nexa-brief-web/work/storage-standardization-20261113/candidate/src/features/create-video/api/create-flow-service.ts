import { createDraft, type Draft, type MediaRef, type StudioValue } from "@/features/studio";
import {
  acceptMediaPlan,
  createMediaPlan,
  getMediaPlan,
} from "@/features/studio/api/studio-service";
import type { TemplateRequirements } from "@/features/templates/types";
import type { CreateFlowDraftRequest } from "../lib/draft-flow";

const PLAN_POLL_MS = 1_500;
// El backend marca "failed" un plan que lleva más de 5 min en "planning";
// del lado del navegador se corta antes, para no dejar el botón colgado.
const PLAN_TIMEOUT_MS = 3 * 60 * 1000;

export type AiProgress = { step: "planning"; done: number; total: number } | { step: "importing" };

export class AiMediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiMediaError";
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** "Que lo resuelva la IA" sin pasar por la revisión del Estudio: arma el
 * plan con el brief (lo ya elegido viaja como lock y no se busca), acepta la
 * selección por defecto de la IA e importa a la librería. Devuelve el
 * contenido completo, listo para el draft. */
export async function resolveMediaWithAi(
  templateId: string,
  requirements: TemplateRequirements,
  content: StudioValue,
  onProgress: (progress: AiProgress) => void,
): Promise<StudioValue> {
  const locks = Object.fromEntries(
    requirements.media
      .map((slot) => [slot.slot, (content.media[slot.slot] ?? []).map((r) => r.assetId)] as const)
      .filter(([, ids]) => ids.length > 0),
  );
  let plan = await createMediaPlan({
    template_id: templateId,
    brief: content.brief.trim() || undefined,
    locks,
  });

  const deadline = Date.now() + PLAN_TIMEOUT_MS;
  while (plan.status === "planning") {
    onProgress({ step: "planning", done: plan.progress.done, total: plan.progress.total });
    if (Date.now() > deadline) throw new AiMediaError("timeout");
    await wait(PLAN_POLL_MS);
    plan = await getMediaPlan(plan.plan_id);
  }
  if (plan.status === "failed") throw new AiMediaError(plan.error ?? "failed");

  onProgress({ step: "importing" });
  const { template_inputs } = await acceptMediaPlan(plan.plan_id);

  const media: Record<string, MediaRef[]> = { ...content.media };
  for (const slot of plan.slots) {
    if (slot.locked) continue;
    const ids = template_inputs.media[slot.slot] ?? [];
    if (ids.length > 0) {
      media[slot.slot] = ids.map((assetId) => ({ assetId, kind: slot.search_kind }));
    }
  }
  return { ...content, media };
}

export interface CreatedDrafts {
  drafts: Draft[];
  /** Error del primer draft que no se pudo crear (los anteriores siguen). */
  error: unknown | null;
}

/** Un draft por video pedido, en serie: cada POST valida capacidad (429) y
 * cuentas por su cuenta, así que si el tercero falla los dos primeros ya
 * están corriendo y se informan igual — mismo criterio que la bandeja. */
export async function createDraftsInSequence(
  request: CreateFlowDraftRequest,
  quantity: number,
  onCreated: (draft: Draft) => void,
): Promise<CreatedDrafts> {
  const drafts: Draft[] = [];
  for (let i = 0; i < quantity; i += 1) {
    try {
      // CreateFlowDraftRequest es un superconjunto de DraftRequest (agrega
      // render_target, user_context y song_info, que el backend acepta).
      const draft = await createDraft(request);
      drafts.push(draft);
      onCreated(draft);
    } catch (error) {
      return { drafts, error };
    }
  }
  return { drafts, error: null };
}
