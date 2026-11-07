import type { JobStage } from "@/features/create-video/types";

export type MediaAssetKind = "image" | "video";

/** Un medio elegido para un lugar: el id de la librería y su tipo (un lugar
 * "image|video" acepta los dos, y el fondo va a image_ o video_asset_id). */
export interface MediaRef {
  assetId: string;
  kind: MediaAssetKind;
}

/** Lo que el usuario eligió en el formulario de requisitos. */
export interface StudioValue {
  musicAssetId: string | null;
  media: Record<string, MediaRef[]>;
  texts: Record<string, string>;
  brief: string;
}

export const EMPTY_STUDIO_VALUE: StudioValue = {
  musicAssetId: null,
  media: {},
  texts: {},
  brief: "",
};

export type RecorderEngine = "remotion" | "hyperframes" | "playwright";
export type RecordFormat = "16x9" | "9x16";

export interface RenderOptions {
  recorderEngine?: RecorderEngine;
  publishAccounts: string[];
  /** Formatos a grabar: 16:9 siempre; 9:16 se suma. */
  formats?: RecordFormat[];
  /** Un formato por cuenta ("platform:alias"). */
  accountFormats?: Record<string, RecordFormat>;
}

export type DraftStatus =
  | "previewing"
  | "preview_ready"
  | "preparing"
  | "prepared"
  | "rendering"
  | "rendered"
  | "failed";

export type DetailsPlatform = "youtube" | "facebook" | "instagram" | "tiktok";
export const DETAILS_PLATFORMS: DetailsPlatform[] = ["youtube", "facebook", "instagram", "tiktok"];

export interface PlatformDetails {
  title: string;
  description: string;
  tags: string[];
  strategy: string;
  /** YouTube: el comentario que se publica y se fija. */
  pinned_comment?: string;
}

/** Textos de publicación de un prototipo (Preparar → Detalles). */
export interface DraftDetails {
  songName: string;
  artist: string;
  language: string | null;
  copies: Partial<Record<DetailsPlatform, PlatformDetails>>;
  generatedAt: string | null;
  edited: boolean;
  /** Investigación previa: lo que la IA ordenó de la información de la canción. */
  research: string;
}

export interface TemplateInputsPayload {
  media: Record<string, string[]>;
  texts: Record<string, string>;
  brief?: string | null;
}

export interface DraftRequest {
  template_id: string;
  name?: string;
  music_asset_id?: string;
  image_asset_id?: string;
  video_asset_id?: string;
  template_inputs?: TemplateInputsPayload;
  auto_render?: { recorder_engine?: RecorderEngine; publish_accounts: string[] };
}

export interface Draft {
  draftId: string;
  templateId: string;
  /** Nombre del prototipo en el Sandbox. */
  name: string;
  /** «Video original»: la plantilla tal cual, con su canción y su fondo. */
  original: boolean;
  /** «Información de la canción» que se le pasó a la IA al preparar (opcional). */
  songNotes: string;
  status: DraftStatus;
  stage: JobStage;
  errors: string[];
  inputs: {
    musicAssetId: string | null;
    imageAssetId: string | null;
    videoAssetId: string | null;
    templateInputs: TemplateInputsPayload | null;
  };
  /** URL absoluta del index.html del preview, o null hasta que esté listo. */
  previewUrl: string | null;
  jobId: string | null;
  recoverable: boolean;
  details: DraftDetails | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockItem {
  provider: string;
  provider_id: string;
  kind: MediaAssetKind;
  title: string;
  preview_url: string;
  download_url: string;
  width: number;
  height: number;
  duration_seconds: number | null;
  author: string;
  author_url: string;
  source_url: string;
  license: string;
  library_asset_id: string | null;
}

export interface StockProviderIssue {
  provider: string;
  code: string;
  message: string;
}

export interface StockSearchResult {
  results: StockItem[];
  provider_errors: StockProviderIssue[];
}

export interface StockImportResult {
  asset_id: string;
  kind: MediaAssetKind;
  already_imported: boolean;
}

export interface MediaPlanSlot {
  slot: string;
  search_kind: MediaAssetKind;
  min: number;
  max: number;
  label: string;
  locked: boolean;
  query: string | null;
  candidates: StockItem[];
  selected: string[];
  provider_errors: StockProviderIssue[];
}

export interface MediaPlan {
  plan_id: string;
  template_id: string;
  status: "planning" | "ready" | "failed";
  error: string | null;
  progress: { done: number; total: number };
  slots: MediaPlanSlot[];
}
