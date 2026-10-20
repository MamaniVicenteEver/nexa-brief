/** "10"/"20" = preview rápido de N segundos; "full" = video completo (programable y publicable). */
export type RecordDuration = "10" | "20" | "full";

/** Formato horizontal 16:9 o vertical 9:16; cada cuenta define cuál publica. */
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
  /** Un resultado por cuenta y formato: URL si se publicó, error si falló. */
  publishResults: {
    accountSelector: string;
    format?: RecordFormat;
    url: string | null;
    error: string | null;
  }[];
  formats: RecordFormat[];
  /** Cuánto tardó la grabación (segundos); null mientras corre. */
  renderSeconds: number | null;
}

export type TitleOptionId = "A" | "B" | "C";

export interface TitleOption {
  option: TitleOptionId;
  text: string;
  /** Número de estrategia de gancho (1–10) y su nombre. */
  strategy: number;
  strategyName: string;
  emotion: string;
}

/** Una de las dos composiciones de miniatura que se puede previsualizar en el reproductor. */
export type ThumbnailPreview =
  | { option: "A"; lines: string[]; highlight: string; componentPreviewUrl?: string }
  | { option: "B"; text: string; imageUrl: string | null; componentPreviewUrl?: string };

export interface PublishIssue {
  level: "error" | "warning";
  field: string;
  message: string;
}

/** publish.json v2: el paquete de publicación (src/core/explainer/publishing en el server). */
export interface PublishPackage {
  thumbnail: {
    /** Antetítulo de las dos miniaturas (lugar · fecha). */
    kicker: string;
    textOnly: { lines: string[]; highlight: string; pairTitle: TitleOptionId };
    withImage: {
      text: string;
      imageUrl: string | null;
      pairTitle: TitleOptionId;
      /** Lado de la foto en la intro 16:9; "auto" alterna entre videos. */
      imageSide: "auto" | "left" | "right";
    };
    /** La elegida es también la apertura del video (los primeros segundos). */
    chosen: "text_only" | "with_image";
  };
  titles: {
    youtube: TitleOption[];
    chosen: TitleOptionId;
  };
  pinnedComment: string;
}

export interface PublishPackageReview {
  /** null si el publish.json v2 no se pudo leer (el motivo está en `issues`). */
  package: PublishPackage | null;
  issues: PublishIssue[];
  /** Largo máximo de un título de YouTube según la estrategia activa del server. */
  titleMaxChars: number;
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
  /** Solo en videos con paquete de publicación v2. */
  publishPackage: PublishPackageReview | null;
  /** Miniaturas de YouTube: capturas de la intro (A = introv1, B = introv2). */
  thumbnails: VideoThumbnails;
}

export type ThumbnailOptionId = "A" | "B";

export interface VideoThumbnail {
  option: ThumbnailOptionId;
  /** <diseño>.introv1 (A, solo texto) o <diseño>.introv2 (B, texto + foto). */
  component: string;
  /** Params con que esa intro abre el video (los mismos de la captura): para la vista previa. */
  params: Record<string, unknown>;
  /** Captura render/thumbnail-<opción>.jpg; null si todavía no se capturó. */
  url: string | null;
}

export interface VideoThumbnails {
  /** null si el diseño no tiene intros para miniaturas. */
  chosen: ThumbnailOptionId | null;
  options: VideoThumbnail[];
}

export interface RecordExplainerInput {
  videoId: string;
  duration: RecordDuration;
  publish: boolean;
  privacy: ExplainerJob["privacy"];
  accountSelector?: string;
  /** Varios canales a la vez ("youtube:alias", "tiktok:alias"…). */
  accountSelectors?: string[];
  /** Formatos para una grabación sin publicar. Al publicar, accountFormats determina cada destino. */
  formats?: RecordFormat[];
  /** Formatos seleccionados por canal; cada formato genera una publicación independiente. */
  accountFormats?: Record<string, RecordFormat[]>;
  /** Miniatura que se sube a YouTube; sin valor, la guardada en el video. */
  thumbnail?: ThumbnailOptionId;
}

export const ACTIVE_JOB_STATES: ExplainerJobState[] = ["queued", "rendering", "publishing"];

// ── Crear: opciones, diseños, textos y producción con agente local ──────────

export type AgentName = "claude" | "codex";
export type TextProvider = "claude" | "codex" | "deepseek";

export interface ProviderStatus<N extends string = string> {
  name: N;
  available: boolean;
}

export interface LengthPreset {
  minutes: number;
  id: string;
  label: string;
}

/** Duración de los videos (explainer-kit/lengths.json en el server). */
export interface LengthOptions {
  presets: LengthPreset[];
  defaultMinutes: number;
  minMinutes: number;
  maxMinutes: number;
}

export interface ExplainerOptions {
  agents: ProviderStatus<AgentName>[];
  textProviders: ProviderStatus<TextProvider>[];
  defaultAgent: AgentName;
  defaultTextProvider: TextProvider;
  lengths: LengthOptions;
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
  /** MP4 grabados de la demo (16:9 y 9:16), o null si todavía no se grabó. */
  videoUrl: string | null;
  videoPortraitUrl: string | null;
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
  /** Duración objetivo en minutos. */
  minutes?: number;
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
  /** Duración objetivo en minutos. */
  minutes?: number;
}

export interface PublishTextsResult {
  videoId: string;
  written: boolean;
  brief: ExplainerBrief;
}
