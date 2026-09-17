export interface Niche {
  id: string;
  displayName: string;
  description: string;
  pipelineType: string;
  active: boolean;
  recorderEngine: string;
  /** Motores que se pueden ofrecer como override sin que el submit falle con
   * 400 — "playwright" siempre está, "remotion"/"hyperframes" solo si el
   * niche tiene una composición portada (ver supports_niche() en el backend). */
  supportedEngines: string[];
}

export type JobStage =
  | "pending"
  | "input_analyzed"
  | "design_complete"
  | "resources_fetched"
  | "prompt_built"
  | "html_generated"
  | "video_recorded"
  | "summary_generated"
  | "packaged"
  | "publishing"
  | "published"
  | "failed";

/** Lo que devuelve POST /videos/upload casi al instante — no el resultado final. */
export interface JobHandle {
  jobId: string;
  category: string;
  stage: JobStage;
}

export interface JobFile {
  format: "youtube" | "reels" | "tiktok" | "thumbnail";
  ready: boolean;
  url: string | null;
}

/** Copia generada por IA en el Stage 7 del pipeline — solo disponible una vez
 * que el job llega a `summary_generated` o más adelante. */
export interface JobSummary {
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeTags: string[];
  tiktokCaption: string;
  tiktokHashtags: string[];
}

/** GET /videos/jobs/{jobId} — usado para pollear el progreso. */
export interface JobDetail {
  jobId: string;
  category: string;
  title: string;
  stage: JobStage;
  isTerminal: boolean;
  isSuccess: boolean;
  errors: string[];
  createdAt: string;
  updatedAt: string;
  durationSeconds: number | null;
  files: JobFile[];
  summary: JobSummary | null;
}

/** GET /videos/jobs — item de listado, para Biblioteca. */
export interface JobListItem {
  jobId: string;
  category: string;
  title: string;
  stage: JobStage;
  isTerminal: boolean;
  createdAt: string;
  updatedAt: string;
  durationSeconds: number | null;
}
