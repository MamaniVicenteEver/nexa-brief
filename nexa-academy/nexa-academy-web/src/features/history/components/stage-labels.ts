/** Etiquetas en español de las 8+1 etapas reales del pipeline — ver
 * `docs/roadmap/dashboard-prototype-api-contracts.md` (sección Historial) y
 * `src/core/job.py::JobStage` en nexa-brief-server. */
export const STAGE_LABELS: Record<string, string> = {
  pending: "Pendiente",
  input_analyzed: "Análisis",
  design_complete: "Diseño visual",
  resources_fetched: "Recursos",
  prompt_built: "Prompt",
  html_generated: "Generación HTML",
  video_recorded: "Grabación",
  summary_generated: "Resumen",
  packaged: "Empaquetado",
  publishing: "Publicando",
  published: "Publicación",
  failed: "Fallido",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}
