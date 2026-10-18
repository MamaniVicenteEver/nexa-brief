/** "10"/"20" = preview rápido de N segundos; "full" = video completo (programable y publicable). */
export type RecordDuration = "10" | "20" | "full";

/** "16x9" = desktop (YouTube/Facebook); "9x16" = móvil (TikTok). */
export type RecordFormat = "16x9" | "9x16";

export type ExplainerJobState = "queued" | "rendering" | "publishing" | "done" | "failed";

export interface ExplainerJob {
  jobId: string;
  videoId: string;
  state: ExplainerJobState;
  categoryPath: string;
  duration: RecordDuration;
  publish: boolean;
  privacy: "private" | "unlisted" | "public";
  accountSelector: string | null;
  error: string | null;
  outputs: string[];
  outputDir: string | null;
  scheduledJobId: string | null;
  publishResult: { postId: string; url: string; platform: string; accountAlias: string } | null;
  /** Un resultado por canal: url si se publicó, error si falló. */
  publishResults: { accountSelector: string; url: string | null; error: string | null }[];
  formats: RecordFormat[];
  /** Cuánto tardó la grabación (segundos); null mientras corre. */
  renderSeconds: number | null;
}

export interface ExplainerVideo {
  videoId: string;
  design: string;
  categoryId: string;
  categoryName: string;
  categoryPath: string;
  title: string;
  topic: string;
  status: string;
  ready: boolean;
  publishReady: boolean;
  rendered: string[];
  durationSeconds: number | null;
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeTags: string[];
  facebookTitle: string;
  facebookDescription: string;
  tiktokCaption: string;
  tiktokHashtags: string[];
  /** Nombre del diseño/canal (PROTOTIPO, NODEHISTORY…). */
  designName: string;
  /** Demo de un diseño (mismo guion que otro video): ojo al publicar. */
  demo: boolean;
  /** URL absoluta de la página HTML que reproduce el video (para un iframe). */
  previewUrl: string;
  /** Portada fija (render/poster.jpg); null si todavía no tiene. */
  posterUrl: string | null;
  lastJob: ExplainerJob | null;
}

export interface RecordExplainerInput {
  videoId: string;
  duration: RecordDuration;
  publish: boolean;
  privacy: ExplainerJob["privacy"];
  accountSelector?: string;
  /** Varios canales a la vez ("youtube:alias", "tiktok:alias"…). */
  accountSelectors?: string[];
  /** Qué grabar; por defecto solo 16:9. Publicar agrega el formato que exija cada red. */
  formats?: RecordFormat[];
}

export const ACTIVE_JOB_STATES: ExplainerJobState[] = ["queued", "rendering", "publishing"];

// ── Crear: opciones, diseños, textos y producción con agente local ──────────

export type AgentName = "claude" | "codex";
export type TextProvider = "claude" | "codex" | "deepseek";

export interface ProviderStatus<N extends string = string> {
  name: N;
  available: boolean;
}

export interface ExplainerOptions {
  agents: ProviderStatus<AgentName>[];
  textProviders: ProviderStatus<TextProvider>[];
  defaultAgent: AgentName;
  defaultTextProvider: TextProvider;
}

export interface ExplainerDesign {
  designId: string;
  name: string;
  tagline: string;
  topics: string[];
  voice: string;
  categoryPath: string | null;
  /** URL absoluta de una demo del diseño, o null si todavía no hay ninguna. */
  previewUrl: string | null;
  /** Portada del video demo del diseño. */
  posterUrl: string | null;
}

/** Diseños del kit agrupados por la categoría dueña (selector visual del modal). */
export interface DesignGroup {
  categoryPath: string;
  categoryName: string;
  designs: ExplainerDesign[];
}

export interface CategoryDesigns {
  categoryPath: string;
  /** true = la categoría no tiene diseños propios y usa los del kit. */
  shared: boolean;
  designs: ExplainerDesign[];
}

/** Textos y ángulo de un video. Se envía tal cual (snake_case) al backend. */
export interface ExplainerBrief {
  video_id: string;
  working_title: string;
  hook: string;
  angle: string;
  thesis: string;
  outline: string[];
  youtube: { title: string; title_alternatives: string[]; description: string; tags: string[] };
  facebook: { title: string; description: string };
  tiktok: { caption: string; hashtags: string[] };
  thumbnail_text: string;
  media_suggestions: string[];
}

export interface BriefInput {
  categoryPath: string;
  topic: string;
  description?: string;
  design?: string;
  provider?: TextProvider;
  mediaNames?: string[];
}

export type ProductionState =
  | "queued"
  | "creating"
  | "producing"
  | "finishing"
  | "ready"
  | "recording"
  | "done"
  | "incomplete"
  | "failed";

export const ACTIVE_PRODUCTION_STATES: ProductionState[] = [
  "queued",
  "creating",
  "producing",
  "finishing",
  "recording",
];

export interface Production {
  productionId: string;
  videoId: string;
  categoryPath: string;
  design: string;
  topic: string;
  description: string;
  agent: string;
  autoRecord: boolean;
  state: ProductionState;
  error: string | null;
  videoStatus: string | null;
  recordJobId: string | null;
  media: string[];
  brief: ExplainerBrief | null;
  agentReport: string | null;
  planItemId: string | null;
  createdAt: string;
  updatedAt: string;
  logTail: string | null;
}

export interface CreateProductionInput {
  categoryPath: string;
  design: string;
  topic: string;
  description?: string;
  agent?: AgentName;
  brief?: ExplainerBrief | null;
  autoRecord?: boolean;
  planItemId?: string;
  files?: File[];
}

export interface PublishTextsResult {
  videoId: string;
  written: boolean;
  brief: ExplainerBrief;
}
