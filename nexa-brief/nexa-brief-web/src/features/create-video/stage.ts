import type { JobStage } from "./types";

const TERMINAL_STAGES: JobStage[] = ["packaged", "published", "failed"];

export function isTerminalStage(stage: JobStage | undefined): boolean {
  return stage !== undefined && TERMINAL_STAGES.includes(stage);
}

/** Mapea cada JobStage a su clave de traducción bajo `createVideo.stages`. */
export const STAGE_LABEL_KEY: Record<JobStage, string> = {
  pending: "pending",
  input_analyzed: "inputAnalyzed",
  design_complete: "designComplete",
  resources_fetched: "resourcesFetched",
  prompt_built: "promptBuilt",
  html_generated: "htmlGenerated",
  video_recorded: "videoRecorded",
  summary_generated: "summaryGenerated",
  packaged: "packaged",
  publishing: "publishing",
  published: "published",
  failed: "failed",
};

/** @deprecated Usado todavía por features/templates y features/library, que
 * no fueron migradas a next-intl en este cambio. Preferir STAGE_LABEL_KEY +
 * t(`stages.${key}`) en createVideo. */
export const STAGE_LABEL_ES: Record<JobStage, string> = {
  pending: "En cola",
  input_analyzed: "Analizando entrada...",
  design_complete: "Diseñando estilo visual...",
  resources_fetched: "Buscando recursos (imagen/música)...",
  prompt_built: "Armando prompt...",
  html_generated: "Generando plantilla...",
  video_recorded: "Grabando video...",
  summary_generated: "Generando título y descripción...",
  packaged: "Listo",
  publishing: "Publicando...",
  published: "Publicado",
  failed: "Falló",
};
