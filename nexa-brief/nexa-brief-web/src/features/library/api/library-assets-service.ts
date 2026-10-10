import { ApiError, parseErrorBody } from "@/infrastructure/api/api-error";
import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";

export type LibraryAssetKind = "images" | "music" | "videos";

export type TranscriptionStatus = "none" | "pending" | "running" | "done" | "failed";

/** Campos comunes a los tres tipos. Todo lo que no sea asset_id/category es
 * opcional porque registros viejos del backend pueden no traerlos. */
interface BaseAssetDto {
  asset_id: string;
  category: string;
  source?: string;
  provider?: string;
  original_filename?: string;
  description?: string;
  tags?: string;
  tag_list?: string[];
  license_note?: string;
  added_at?: string;
  usage_count?: number;
}

interface ImageAssetDto extends BaseAssetDto {
  label: string;
  width: number;
  height: number;
  photographer?: string;
}

interface MusicAssetDto extends BaseAssetDto {
  track_name: string;
  artist: string;
  genre?: string;
  language?: string;
  duration_seconds: number;
  transcription_status?: TranscriptionStatus;
  transcription_error?: string;
  lyrics_url?: string | null;
}

interface VideoAssetDto extends BaseAssetDto {
  label: string;
  width?: number;
  height?: number;
  duration_seconds: number;
}

export interface LibraryAsset {
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
}

function baseFields(kind: LibraryAssetKind, dto: BaseAssetDto) {
  return {
    assetId: dto.asset_id,
    kind,
    category: dto.category,
    fileUrl: resolveAssetFileUrl(kind, dto.asset_id),
    originalFilename: dto.original_filename ?? "",
    description: dto.description ?? "",
    tags:
      dto.tag_list ??
      (dto.tags ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    addedAt: dto.added_at ?? null,
    usageCount: dto.usage_count ?? 0,
    artist: "",
    genre: "",
    language: "",
    transcriptionStatus: null,
    transcriptionError: "",
    hasLyrics: false,
  };
}

function mapImageAsset(dto: ImageAssetDto): LibraryAsset {
  return {
    ...baseFields("images", dto),
    title: dto.label || dto.asset_id,
    name: dto.label ?? "",
    width: dto.width || null,
    height: dto.height || null,
    durationSeconds: null,
  };
}

function mapMusicAsset(dto: MusicAssetDto): LibraryAsset {
  return {
    ...baseFields("music", dto),
    title: dto.artist ? `${dto.track_name} — ${dto.artist}` : dto.track_name || dto.asset_id,
    name: dto.track_name ?? "",
    width: null,
    height: null,
    durationSeconds: dto.duration_seconds || null,
    artist: dto.artist ?? "",
    genre: dto.genre ?? "",
    language: dto.language ?? "",
    transcriptionStatus: dto.transcription_status ?? "none",
    transcriptionError: dto.transcription_error ?? "",
    hasLyrics: Boolean(dto.lyrics_url),
  };
}

function mapVideoAsset(dto: VideoAssetDto): LibraryAsset {
  return {
    ...baseFields("videos", dto),
    title: dto.label || dto.asset_id,
    name: dto.label ?? "",
    width: dto.width || null,
    height: dto.height || null,
    durationSeconds: dto.duration_seconds || null,
  };
}

function mapAsset(kind: LibraryAssetKind, dto: unknown): LibraryAsset {
  if (kind === "images") return mapImageAsset(dto as ImageAssetDto);
  if (kind === "music") return mapMusicAsset(dto as MusicAssetDto);
  return mapVideoAsset(dto as VideoAssetDto);
}

export function resolveAssetFileUrl(kind: LibraryAssetKind, assetId: string): string {
  return resolveApiUrl(`/api/v1/library/${kind}/${assetId}/file`);
}

export interface LibrarySearchParams {
  q?: string;
  category?: string;
}

export async function getLibraryAssets(
  kind: LibraryAssetKind,
  signal?: AbortSignal,
  params: LibrarySearchParams = {},
): Promise<LibraryAsset[]> {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.category) search.set("category", params.category);
  const qs = search.toString();
  const dtos = await httpClient<unknown[]>(`/api/v1/library/${kind}${qs ? `?${qs}` : ""}`, {
    signal,
  });
  return dtos.map((dto) => mapAsset(kind, dto));
}

export async function getLibraryAsset(
  kind: LibraryAssetKind,
  assetId: string,
  signal?: AbortSignal,
): Promise<LibraryAsset> {
  return mapAsset(
    kind,
    await httpClient<unknown>(`/api/v1/library/${kind}/${assetId}`, { signal }),
  );
}

export async function getLibraryCategories(
  kind: LibraryAssetKind,
  signal?: AbortSignal,
): Promise<string[]> {
  return httpClient<string[]>(`/api/v1/library/categories?kind=${kind}`, { signal });
}

export interface UploadAssetInput {
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

/** Sube con XMLHttpRequest y no con fetch: fetch no expone el progreso de
 * subida, y con canciones/videos de decenas de MB la barra es necesaria. */
export function uploadLibraryAsset(
  kind: LibraryAssetKind,
  input: UploadAssetInput,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<UploadAssetResult> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("category", input.category || "uploads");
  if (input.name) form.append(kind === "music" ? "track_name" : "label", input.name);
  if (input.description) form.append("description", input.description);
  if (input.tags) form.append("tags", input.tags);
  if (kind === "music") {
    if (input.artist) form.append("artist", input.artist);
    if (input.language) form.append("language", input.language);
    form.append("transcribe", String(input.transcribe ?? true));
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", resolveApiUrl(`/api/v1/library/${kind}`));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ asset: mapAsset(kind, body), created: xhr.status === 201 });
      } else {
        reject(parseErrorBody(xhr.status, body));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "No se pudo subir el archivo"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

export interface AssetPatch {
  category?: string;
  /** label (imagen/video) o track_name (música). */
  name?: string;
  artist?: string;
  genre?: string;
  description?: string;
  tags?: string[];
  language?: string;
}

export async function updateLibraryAsset(
  kind: LibraryAssetKind,
  assetId: string,
  patch: AssetPatch,
): Promise<LibraryAsset> {
  const { name, ...rest } = patch;
  const body: Record<string, unknown> = { ...rest };
  if (name !== undefined) body[kind === "music" ? "track_name" : "label"] = name;
  const dto = await httpClient<unknown>(`/api/v1/library/${kind}/${assetId}`, {
    method: "PATCH",
    body,
  });
  return mapAsset(kind, dto);
}

export async function deleteLibraryAsset(kind: LibraryAssetKind, assetId: string): Promise<void> {
  await httpClient(`/api/v1/library/${kind}/${assetId}`, { method: "DELETE" });
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

export async function getLyrics(assetId: string, signal?: AbortSignal): Promise<Lyrics> {
  const raw = await httpClient<{
    metadata?: { language?: string };
    segments?: LyricsSegment[];
  }>(`/api/v1/library/music/${assetId}/lyrics`, { signal });
  return {
    language: raw.metadata?.language ?? "",
    segments: (raw.segments ?? []).map((s) => ({ ...s, words: s.words ?? [] })),
  };
}

export async function retranscribe(assetId: string, language?: string): Promise<LibraryAsset> {
  const dto = await httpClient<unknown>(`/api/v1/library/music/${assetId}/transcribe`, {
    method: "POST",
    body: language ? { language } : {},
  });
  return mapAsset("music", dto);
}
