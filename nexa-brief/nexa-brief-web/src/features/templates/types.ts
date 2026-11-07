import type { JobStage } from "@/features/create-video/types";

export type TemplateOrientation = "9:16" | "16:9" | "any";

export interface Template {
  id: string;
  nicheId: string;
  categoryId: string;
  categoryName: string;
  categoryOrder: number;
  tags: string[];
  sortOrder: number;
  status: string;
  canGenerate: boolean;
  displayName: string;
  nativeOrientation: TemplateOrientation;
  requiresImage: boolean;
  requiresVideo: boolean;
  requiresLyrics: boolean;
  active: boolean;
  previewImageUrl: string | null;
  previewVideoUrl: string | null;
  previewAudioUrl: string | null;
  showcaseUrl: string | null;
}

/** Respuesta inmediata de POST /templates/{id}/preview — fire-and-forget. */
export interface TemplatePreviewHandle {
  previewId: string;
  templateId: string;
  categoryName: string;
  stage: JobStage;
}

export interface PreviewFile {
  filename: string;
  url: string | null;
}

/** GET /templates/preview/{id}/status — usado para pollear el progreso. */
export interface PreviewStatus {
  previewId: string;
  category: string;
  stage: JobStage;
  isTerminal: boolean;
  isSuccess: boolean;
  errors: string[];
  files: PreviewFile[];
}

// ── Requisitos de una plantilla (GET /templates/{id}/requirements) ──────────

export type RequirementMediaKind = "image" | "video" | "image|video";

/** Un lugar de medios de la plantilla. `target: "source"` es el fondo del job
 * (va como image_asset_id/video_asset_id); `"media"` reemplaza las entradas
 * `media` del config de la plantilla (va en template_inputs.media). */
export interface RequirementMediaSlot {
  slot: string;
  kind: RequirementMediaKind;
  min: number;
  max: number;
  orientation: "landscape" | "portrait" | "square" | null;
  /** "config": fondo opcional que va a la ruta `path` del config (si no se sube, queda el de la plantilla). */
  target: "source" | "media" | "config";
  path?: string | null;
  label: string;
  hint: string;
}

export interface RequirementText {
  /** Path con puntos dentro del config (ej. `brand.tag`). */
  key: string;
  label: string;
  max: number | null;
  default: string | null;
}

export interface TemplateRequirements {
  audio: { required: boolean; lyrics: "auto" | "optional" | "none" };
  media: RequirementMediaSlot[];
  texts: RequirementText[];
  brief: boolean;
}
