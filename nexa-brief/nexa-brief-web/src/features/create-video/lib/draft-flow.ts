import { buildDraftRequest, type DraftRequest, type StudioValue } from "@/features/studio";
import type { Template, TemplateRequirements } from "@/features/templates/types";
import type { CreateVideoFormValues } from "../schema";
import type { Niche } from "../types";

export const EMPTY_CONTENT: StudioValue = { musicAssetId: null, media: {}, texts: {}, brief: "" };

/** La plantilla generable del nicho (relación 1:1 en niches.json). Solo los
 * nichos `config_driven_template` activos tienen una — `canGenerate` es el
 * mismo chequeo que hace POST /drafts para resolver el nicho desde la
 * plantilla, así que si acá hay plantilla, el draft no va a dar 404. */
export function findNicheTemplate(
  niche: Niche | undefined,
  templates: Template[] | undefined,
): Template | null {
  if (!niche) return null;
  return templates?.find((t) => t.nicheId === niche.id && t.canGenerate) ?? null;
}

/** Lo elegido para ESTA plantilla; si quedó guardado de otra, vacío. */
export function contentFor(values: CreateVideoFormValues, templateId: string | null): StudioValue {
  if (!templateId || values.contentTemplateId !== templateId) return EMPTY_CONTENT;
  return values.content ?? EMPTY_CONTENT;
}

/** POST /drafts fija la duración en "auto × 1" (la de la canción) porque el
 * preview la congela y el grabado retoma ese mismo job. Cualquier otra
 * duración solo la respeta el flujo clásico de /videos/upload. */
export function durationFitsDrafts(values: CreateVideoFormValues): boolean {
  return values.durationMode === "auto" && (values.repeatCount || 1) === 1;
}

/** Lugares que todavía no tienen lo mínimo (o nada, si el mínimo es 0). Con
 * brief, la IA los completa al generar; sin brief, el backend usa los medios
 * por defecto de la plantilla (o busca un fondo automático). */
export function unfilledSlots(requirements: TemplateRequirements, value: StudioValue): string[] {
  return requirements.media
    .filter((slot) => (value.media[slot.slot]?.length ?? 0) < Math.max(slot.min, 1))
    .map((slot) => slot.slot);
}

/** `auto_render` de POST /drafts con render_target: el tipo del Estudio no lo
 * declara (el Estudio no ofrece AWS), pero el backend lo acepta y valida. */
export interface CreateFlowDraftRequest extends Omit<DraftRequest, "auto_render"> {
  auto_render: {
    recorder_engine?: CreateVideoFormValues["recorderEngineOverride"];
    render_target?: CreateVideoFormValues["renderTarget"];
    publish_accounts: string[];
  };
  user_context?: string;
  song_info?: {
    song_name?: string;
    artist?: string;
    topic?: string;
    description?: string;
    language?: string;
  };
}

/** Body de POST /drafts para el flujo de un paso: el contenido sale de
 * buildDraftRequest (mismo mapeo que el Estudio: fondo → image/video_asset_id,
 * el resto en template_inputs) y lo operativo del formulario va en
 * auto_render para que se grabe solo apenas el preview quede listo. */
export function buildCreateFlowDraftRequest(
  templateId: string,
  requirements: TemplateRequirements,
  content: StudioValue,
  values: CreateVideoFormValues,
): CreateFlowDraftRequest {
  const request: CreateFlowDraftRequest = {
    ...buildDraftRequest(templateId, requirements, content),
    auto_render: {
      recorder_engine: values.recorderEngineOverride,
      render_target: values.renderTarget,
      publish_accounts: values.publishingAccounts,
    },
  };
  const userContext = values.userContext?.trim();
  if (userContext) request.user_context = userContext;

  const songInfo = {
    song_name: values.songName || undefined,
    artist: values.artist || undefined,
    topic: values.topic || undefined,
    description: values.songDescription || undefined,
    language: values.language || undefined,
  };
  if (Object.values(songInfo).some(Boolean)) request.song_info = songInfo;
  return request;
}

/** Flujo clásico desde una plantilla con requisitos (duración a medida): solo
 * viajan la canción y el fondo, que /videos/upload acepta como asset_id. Los
 * medios propios y los textos de la plantilla no tienen equivalente ahí. */
export function uploadValuesFromContent(
  values: CreateVideoFormValues,
  requirements: TemplateRequirements,
  content: StudioValue,
): CreateVideoFormValues {
  const next: CreateVideoFormValues = {
    ...values,
    imageFile: undefined,
    musicFile: undefined,
    videoFile: undefined,
    imageAssetId: undefined,
    videoAssetId: undefined,
    musicAssetId: content.musicAssetId ?? undefined,
  };
  const source = requirements.media.find((slot) => slot.target === "source");
  const first = source ? content.media[source.slot]?.[0] : undefined;
  if (first?.kind === "image") next.imageAssetId = first.assetId;
  if (first?.kind === "video") next.videoAssetId = first.assetId;
  return next;
}

/** True si el contenido elegido incluye algo que /videos/upload no puede
 * llevar (medios de lugares `media` o textos) — para avisar antes de generar. */
export function contentNeedsDrafts(
  templateId: string,
  requirements: TemplateRequirements,
  content: StudioValue,
): boolean {
  const request = buildDraftRequest(templateId, requirements, content);
  const inputs = request.template_inputs;
  if (!inputs) return false;
  const sourceSlots = new Set(
    requirements.media.filter((s) => s.target === "source").map((s) => s.slot),
  );
  const ownMedia = Object.keys(inputs.media).some((slot) => !sourceSlots.has(slot));
  return ownMedia || Object.keys(inputs.texts).length > 0;
}
