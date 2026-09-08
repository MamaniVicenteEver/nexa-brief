import type { JobStage } from "@/features/create-video/types";

export type TemplateOrientation = "9:16" | "16:9" | "any";

export interface Template {
  id: string;
  nicheId: string;
  displayName: string;
  nativeOrientation: TemplateOrientation;
  requiresImage: boolean;
  requiresVideo: boolean;
  requiresLyrics: boolean;
  active: boolean;
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
