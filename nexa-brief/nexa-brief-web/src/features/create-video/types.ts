export interface Niche {
  id: string;
  displayName: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categoryOrder: number;
  tags: string[];
  sortOrder: number;
  pipelineType: string;
  active: boolean;
  recorderEngine: string;
  /** Motores que se pueden ofrecer como override sin que el submit falle con
   * 400 — "playwright" siempre está, "remotion"/"hyperframes" solo si el
   * niche tiene una composición portada (ver supports_niche() en el backend). */
  supportedEngines: string[];
  /** Nichos de letras: la duración es siempre la de la canción (manual se ignora). */
  durationLockedToMusic: boolean;
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
  pinnedComment: string;
  platformCopies: Record<string, { title: string; description: string; tags: string[] }>;
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
  /** Segundos que tardó en generarse (null mientras sigue en curso). */
  generationSeconds: number | null;
  files: JobFile[];
  /** Relaciones de aspecto grabadas ("16x9", "9x16"). */
  formats: string[];
  summary: JobSummary | null;
  /** Solo para jobs que el servidor está corriendo o corrió hace poco. */
  progress: JobProgress | null;
}

export type JobProgressStatus = "queued" | "running" | "done" | "failed";

/** Evento realtime `job_progress` (y campo `progress` de GET /videos/jobs/{id}). */
export interface JobProgress {
  status: JobProgressStatus;
  /** Paso que está CORRIENDO ahora (ej. "video_recorder") — `stage` es el último que terminó. */
  step: string | null;
  stepIndex: number;
  stepCount: number;
  /** Todo el job, 0-100. */
  percent: number;
  /** Paso actual, cuando el paso lo reporta (renders). */
  stepPercent: number | null;
  queuePosition: number | null;
  etaSeconds: number | null;
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
  /** Segundos que tardó en generarse (null mientras sigue en curso). */
  generationSeconds: number | null;
}
