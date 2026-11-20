export type LibraryAssetKind = "images" | "music" | "videos" | "sounds";

export type TranscriptionStatus = "none" | "pending" | "running" | "done" | "failed";

export interface LibraryAsset {
  categoryId?: string;
  categoryName?: string;
  templateId?: string;
  templateName?: string;
  productionName?: string;
  mediaType?: string;
  resourceOrigins?: {
    category_id: string;
    category_name: string;
    template_id: string;
    template_name: string;
  }[];
  assetId: string;
  kind: LibraryAssetKind;
  category: string;
  /** Título legible: label (imagen/video) o "track_name — artist" (música). */
  title: string;
  fileUrl: string;
  /** Nombre editable: label (imagen/video) o track_name (música). */
  name: string;
  originalFilename: string;
  description: string;
  tags: string[];
  addedAt: string | null;
  usageCount: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  /** Solo música. */
  artist: string;
  genre: string;
  language: string;
  transcriptionStatus: TranscriptionStatus | null;
  transcriptionError: string;
  hasLyrics: boolean;
  recommendedUses: string[];
  approvalStatus: "pending" | "approved" | "rejected" | null;
  provider: string;
  /** Origen del recurso: "upload", "stock", "template" o "production" (los de producción no se completan aquí). */
  source?: string;
  licenseNote: string;
  licenseUrl: string;
}

export interface LibrarySearchParams {
  q?: string;
  category?: string;
}

export interface UploadAssetInput {
  templateId?: string;
  file: File;
  category?: string;
  /** label (imagen/video) o track_name (música). Si falta, el backend usa el nombre del archivo. */
  name?: string;
  artist?: string;
  description?: string;
  tags?: string;
  language?: string;
  /** Solo música: encolar la transcripción al subir (default del backend: true). */
  transcribe?: boolean;
}

export interface UploadAssetResult {
  asset: LibraryAsset;
  /** false cuando la canción ya estaba (dedupe por sha256, responde 200). */
  created: boolean;
}

export interface AssetPatch {
  category?: string;
  recommended_uses?: string[];
  approval_status?: "pending" | "approved" | "rejected";
  /** label (imagen/video) o track_name (música). */
  name?: string;
  artist?: string;
  genre?: string;
  description?: string;
  tags?: string[];
  language?: string;
}

export interface LyricsWord {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

export interface LyricsSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: LyricsWord[];
}

export interface Lyrics {
  language: string;
  segments: LyricsSegment[];
}

export interface LibraryAssetPage {
  items: LibraryAsset[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LibraryPageParams extends LibrarySearchParams {
  page?: number;
  pageSize?: number;
}

export interface MusicGroupPageParams extends LibraryPageParams {
  /** Filtra por disponibilidad de transcripción antes de agrupar y paginar. */
  hasLyrics?: boolean;
}

/** Un grupo visual; cada versión conserva su propio identificador y letra. */
export interface MusicGroup {
  title: string;
  artist: string;
  items: LibraryAsset[];
}

export interface MusicGroupPage {
  items: MusicGroup[];
  total: number;
  page: number;
  pageSize: number;
}

/** Resultado de «Completar datos»: qué campos se rellenaron y qué fuentes abiertas se usaron. */
export interface EnrichMusicResult {
  status: "actualizado" | "sin_cambios" | "completo" | "no_encontrada" | "error";
  fields: string[];
  sources: string[];
  asset: LibraryAsset;
}
