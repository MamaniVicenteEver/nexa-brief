import type { TemplateRequirements } from "@/features/templates/types";
import type { Draft, DraftRequest, MediaAssetKind, MediaRef, StudioValue, TemplateInputsPayload } from "../types";
import { EMPTY_STUDIO_VALUE } from "../types";

/** Qué falta para poder previsualizar: canción obligatoria y mínimos por lugar. */
export function missingRequirements(
  requirements: TemplateRequirements,
  value: StudioValue,
): { song: boolean; slots: string[] } {
  return {
    song: requirements.audio.required && !value.musicAssetId,
    slots: requirements.media
      .filter((slot) => (value.media[slot.slot]?.length ?? 0) < slot.min)
      .map((slot) => slot.slot),
  };
}

/** Valor inicial de un prototipo nuevo: la canción y los medios que trae la plantilla, en su orden. */
export function defaultStudioValue(requirements: TemplateRequirements): StudioValue {
  const defaults = requirements.defaults;
  const media: Record<string, MediaRef[]> = {};
  for (const slot of requirements.media) {
    const items = defaults?.media[slot.slot] ?? [];
    if (items.length > 0) {
      media[slot.slot] = items.slice(0, slot.max).map((item) => ({ assetId: item.assetId, kind: item.kind }));
    }
  }
  return { ...EMPTY_STUDIO_VALUE, musicAssetId: defaults?.audioAssetId ?? null, media };
}

export function isStudioValueComplete(requirements: TemplateRequirements, value: StudioValue) {
  const missing = missingRequirements(requirements, value);
  return !missing.song && missing.slots.length === 0;
}

/** Arma el body de POST /drafts. Los lugares `target: "source"` (el fondo de
 * plantillas de letras/imagen/video) NO los aplica template_inputs en el
 * backend: van como image_asset_id/video_asset_id del job. El resto viaja en
 * template_inputs.media; los textos solo si difieren del valor por defecto,
 * para no pisar el config con lo mismo. */
export function buildDraftRequest(
  templateId: string,
  requirements: TemplateRequirements,
  value: StudioValue,
): DraftRequest {
  const request: DraftRequest = { template_id: templateId };
  if (value.musicAssetId) request.music_asset_id = value.musicAssetId;

  const media: Record<string, string[]> = {};
  const mediaKinds: Record<string, MediaAssetKind[]> = {};
  for (const slot of requirements.media) {
    const explicitlySelected = Object.prototype.hasOwnProperty.call(value.media, slot.slot);
    const refs = (value.media[slot.slot] ?? []).slice(0, slot.max);
    if (refs.length === 0) {
      if (slot.min === 0 && explicitlySelected && slot.target !== "source") {
        media[slot.slot] = [];
        mediaKinds[slot.slot] = [];
      }
      continue;
    }
    media[slot.slot] = refs.map((ref) => ref.assetId);
    mediaKinds[slot.slot] = refs.map((ref) => ref.kind);
    if (slot.target === "source") {
      const first = refs[0];
      if (first.kind === "image") request.image_asset_id = first.assetId;
      else request.video_asset_id = first.assetId;
    }
  }

  const texts: Record<string, string> = {};
  for (const field of requirements.texts) {
    const current = value.texts[field.key];
    if (current !== undefined && current !== (field.default ?? "")) texts[field.key] = current;
  }

  // Solo se envían ajustes de slots declarados. Ausencia significa conservar
  // el aspecto original de drafts anteriores.
  const mediaOpacity: Record<string, number> = {};
  for (const slot of requirements.media) {
    const opacity = value.mediaOpacity?.[slot.slot];
    if (typeof opacity === "number" && Number.isFinite(opacity)) {
      mediaOpacity[slot.slot] = Math.max(0, Math.min(1, opacity));
    }
  }
  const brief = value.brief.trim();
  if (
    Object.keys(media).length > 0 ||
    Object.keys(texts).length > 0 ||
    Object.keys(mediaOpacity).length > 0 ||
    brief
  ) {
    request.template_inputs = { media, media_kinds: mediaKinds, texts, brief: brief || null };
    if (Object.keys(mediaOpacity).length > 0) request.template_inputs.media_opacity = mediaOpacity;
  }
  return request;
}

/** Firma estable de lo elegido: si cambia respecto del draft, hay que volver
 * a previsualizar antes de grabar. */
export function studioValueSignature(
  templateId: string,
  requirements: TemplateRequirements,
  value: StudioValue,
) {
  return JSON.stringify(buildDraftRequest(templateId, requirements, value));
}

/** Reconstruye el formulario desde un draft guardado (al reabrir el modal). */
export function studioValueFromDraft(
  draft: Draft,
  requirements: TemplateRequirements,
): StudioValue {
  const inputs: TemplateInputsPayload | null = draft.inputs.templateInputs;
  const media: Record<string, MediaRef[]> = {};
  for (const slot of requirements.media) {
    const ids = inputs?.media?.[slot.slot] ?? [];
    if (ids.length > 0) {
      media[slot.slot] = ids.map((assetId, index) => ({
        assetId,
        // Sin más datos, el tipo sale del id de fondo o del tipo del lugar.
        kind: inputs?.media_kinds?.[slot.slot]?.[index] ?? (assetId === draft.inputs.videoAssetId || slot.kind === "video" ? "video" : "image"),
      }));
    } else if (Object.prototype.hasOwnProperty.call(inputs?.media ?? {}, slot.slot)) {
      // Mantener un borrado explícito al reabrir y volver a previsualizar.
      media[slot.slot] = [];
    } else if (slot.target === "source") {
      if (draft.inputs.imageAssetId && slot.kind !== "video") {
        media[slot.slot] = [{ assetId: draft.inputs.imageAssetId, kind: "image" }];
      } else if (draft.inputs.videoAssetId && slot.kind !== "image") {
        media[slot.slot] = [{ assetId: draft.inputs.videoAssetId, kind: "video" }];
      }
    }
  }
  return {
    musicAssetId: draft.inputs.musicAssetId,
    media,
    mediaOpacity: { ...(inputs?.media_opacity ?? {}) },
    texts: { ...(inputs?.texts ?? {}) },
    brief: inputs?.brief ?? "",
  };
}
