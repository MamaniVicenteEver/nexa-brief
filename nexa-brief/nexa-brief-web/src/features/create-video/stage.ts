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
