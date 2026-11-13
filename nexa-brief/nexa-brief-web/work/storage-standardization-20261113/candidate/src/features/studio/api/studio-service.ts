import type { JobStage } from "@/features/create-video/types";
import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";
import type {
  Draft,
  DraftDetails,
  DraftRequest,
  DraftStatus,
  DraftThumbnailOption,
  DraftThumbnailOptionId,
  DraftThumbnails,
  MediaPlan,
  RenderOptions,
  StockImportResult,
  StockItem,
  StockSearchResult,
  TemplateInputsPayload,
} from "../types";

// Crear un draft o importar de stock hace trabajo real en el server (validar
// assets, descargar archivos): más margen que el timeout por defecto de 5 s.
const SLOW_TIMEOUT_MS = 60_000;

// ── Drafts ──────────────────────────────────────────────────────────────────

interface DraftDetailsDto {
  song_name: string;
  artist: string;
  language: string | null;
  copies: Record<string, { title: string; description: string; tags: string[]; strategy: string }>;
  generated_at: string | null;
  edited: boolean;
  research?: string;
}

interface DraftDto {
  draft_id: string;
  template_id: string;
  name?: string;
  original?: boolean;
  song_notes?: string;
  status: DraftStatus;
  stage: JobStage;
  errors: string[];
  inputs: {
    music_asset_id?: string | null;
    image_asset_id?: string | null;
    video_asset_id?: string | null;
    template_inputs?: TemplateInputsPayload | null;
  };
  preview_url: string | null;
  job_id: string | null;
  recoverable: boolean;
  details?: DraftDetailsDto | null;
  thumbnails?: DraftThumbnails | null;
  thumbnail_error?: string | null;
  created_at: string;
  updated_at: string;
}

function mapDetails(dto: DraftDetailsDto): DraftDetails {
  return {
    songName: dto.song_name ?? "",
    artist: dto.artist ?? "",
    language: dto.language ?? null,
    copies: dto.copies ?? {},
    generatedAt: dto.generated_at ?? null,
    edited: Boolean(dto.edited),
    research: dto.research ?? "",
  };
}

function detailsDto(details: DraftDetails): DraftDetailsDto {
  return {
    song_name: details.songName,
    artist: details.artist,
    language: details.language,
    copies: details.copies as DraftDetailsDto["copies"],
    generated_at: details.generatedAt,
    edited: details.edited,
    research: details.research,
  };
}

export function mapDraft(dto: DraftDto): Draft {
  return {
    draftId: dto.draft_id,
    templateId: dto.template_id,
    name: dto.name ?? "",
    original: Boolean(dto.original),
    songNotes: dto.song_notes ?? "",
    status: dto.status,
    stage: dto.stage,
    errors: dto.errors ?? [],
    inputs: {
      musicAssetId: dto.inputs?.music_asset_id ?? null,
      imageAssetId: dto.inputs?.image_asset_id ?? null,
      videoAssetId: dto.inputs?.video_asset_id ?? null,
      templateInputs: dto.inputs?.template_inputs ?? null,
    },
    previewUrl: dto.preview_url ? resolveApiUrl(dto.preview_url) : null,
    jobId: dto.job_id,
    recoverable: dto.recoverable,
    details: dto.details ? mapDetails(dto.details) : null,
    thumbnails: dto.thumbnails
      ? {
          ...dto.thumbnails,
          urls: Object.fromEntries(
            Object.entries(dto.thumbnails.urls).map(([option, url]) => [
              option,
              resolveApiUrl(url),
            ]),
          ),
        }
      : null,
    thumbnailError: dto.thumbnail_error ?? null,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export async function createDraft(request: DraftRequest): Promise<Draft> {
  const dto = await httpClient<DraftDto>("/api/v1/drafts", {
    method: "POST",
    body: request,
    timeoutMs: SLOW_TIMEOUT_MS,
  });
  return mapDraft(dto);
}

export async function getDraft(draftId: string, signal?: AbortSignal): Promise<Draft> {
  return mapDraft(await httpClient<DraftDto>(`/api/v1/drafts/${draftId}`, { signal }));
}

export async function listDrafts(templateId: string, signal?: AbortSignal): Promise<Draft[]> {
  const dto = await httpClient<{ total: number; drafts: DraftDto[] }>(
    `/api/v1/drafts?template_id=${encodeURIComponent(templateId)}`,
    { signal },
  );
  return dto.drafts.map(mapDraft);
}

export async function renderDraft(draftId: string, options: RenderOptions) {
  return httpClient<{ draft_id: string; job_id: string; status: string }>(
    `/api/v1/drafts/${draftId}/render`,
    {
      method: "POST",
      body: {
        recorder_engine: options.recorderEngine,
        background_opacity: options.backgroundOpacity,
        publish_accounts: options.publishAccounts,
        formats: options.formats,
        account_formats: options.accountFormats ?? {},
      },
      timeoutMs: SLOW_TIMEOUT_MS,
    },
  );
}

/** «Video original»: crea (o devuelve el vigente) el prototipo con la canción y el fondo de la
 * plantilla; se previsualiza y se prepara solo. */
export async function createOriginalDraft(templateId: string, songNotes = ""): Promise<Draft> {
  return mapDraft(
    await httpClient<DraftDto>(
      `/api/v1/templates/${encodeURIComponent(templateId)}/original-draft`,
      {
        method: "POST",
        body: { song_notes: songNotes.trim() || null },
        timeoutMs: SLOW_TIMEOUT_MS,
      },
    ),
  );
}

export async function renameDraft(draftId: string, name: string): Promise<Draft> {
  return mapDraft(
    await httpClient<DraftDto>(`/api/v1/drafts/${draftId}`, { method: "PATCH", body: { name } }),
  );
}

export async function deleteDraft(draftId: string): Promise<void> {
  await httpClient(`/api/v1/drafts/${draftId}`, { method: "DELETE" });
}

/** Genera los textos de publicación (responde enseguida; el resultado llega por draft_changed). */
/** Genera los textos; `songNotes` = información de la canción para la IA (opcional). */
export async function prepareDraft(draftId: string, songNotes = ""): Promise<Draft> {
  return mapDraft(
    await httpClient<DraftDto>(`/api/v1/drafts/${draftId}/prepare`, {
      method: "POST",
      body: { song_notes: songNotes.trim() },
      timeoutMs: SLOW_TIMEOUT_MS,
    }),
  );
}

export async function saveDraftDetails(draftId: string, details: DraftDetails): Promise<Draft> {
  return mapDraft(
    await httpClient<DraftDto>(`/api/v1/drafts/${draftId}/details`, {
      method: "PUT",
      body: detailsDto(details),
      timeoutMs: 120_000,
    }),
  );
}

// ── Stock ───────────────────────────────────────────────────────────────────

export interface StockSearchParams {
  q: string;
  kind: "image" | "video";
  orientation?: "landscape" | "portrait" | "square" | null;
  perPage?: number;
}

export async function searchStock(
  params: StockSearchParams,
  signal?: AbortSignal,
): Promise<StockSearchResult> {
  const query = new URLSearchParams({ q: params.q, kind: params.kind });
  if (params.orientation) query.set("orientation", params.orientation);
  // per_page es POR proveedor: con 3 proveedores vuelven hasta 3×.
  query.set("per_page", String(params.perPage ?? 8));
  return httpClient<StockSearchResult>(`/api/v1/stock/search?${query}`, {
    signal,
    timeoutMs: 20_000,
  });
}

export async function importStockItem(
  item: StockItem,
  templateId?: string,
  category?: string,
): Promise<StockImportResult> {
  return httpClient<StockImportResult>("/api/v1/stock/import", {
    method: "POST",
    body: {
      template_id: templateId,
      category,
      provider: item.provider,
      provider_id: item.provider_id,
      kind: item.kind,
      download_url: item.download_url,
      title: item.title,
      author: item.author,
      author_url: item.author_url,
      source_url: item.source_url,
      license: item.license,
    },
    timeoutMs: SLOW_TIMEOUT_MS * 2,
  });
}

// ── Media plans (la IA elige los medios) ────────────────────────────────────

export async function createMediaPlan(body: {
  template_id: string;
  brief?: string;
  locks?: Record<string, string[]>;
}): Promise<MediaPlan> {
  return httpClient<MediaPlan>("/api/v1/media-plans", { method: "POST", body });
}

export async function getMediaPlan(planId: string, signal?: AbortSignal): Promise<MediaPlan> {
  return httpClient<MediaPlan>(`/api/v1/media-plans/${planId}`, { signal });
}

export async function acceptMediaPlan(planId: string) {
  return httpClient<{ plan_id: string; template_inputs: TemplateInputsPayload }>(
    `/api/v1/media-plans/${planId}/accept`,
    { method: "POST", timeoutMs: SLOW_TIMEOUT_MS * 3 },
  );
}

/** Mismo formato que `candidate_ref` del backend. */
export function candidateRef(item: StockItem): string {
  return `${item.provider}:${item.provider_id}`;
}

export async function prepareDraftThumbnails(draftId: string): Promise<Draft> {
  return mapDraft(
    await httpClient<DraftDto>(`/api/v1/drafts/${draftId}/thumbnails`, { method: "POST" }),
  );
}

export async function chooseDraftThumbnail(
  draftId: string,
  option: DraftThumbnailOptionId,
): Promise<Draft> {
  return mapDraft(
    await httpClient<DraftDto>(`/api/v1/drafts/${draftId}/thumbnails`, {
      method: "PUT",
      body: { option },
    }),
  );
}

/** Guarda el copy y el manifest visual de una opción sin volver a capturar imágenes. */
export async function updateDraftThumbnailOption(
  draftId: string,
  option: DraftThumbnailOptionId,
  value: DraftThumbnailOption,
): Promise<Draft> {
  return mapDraft(
    await httpClient<DraftDto>(`/api/v1/drafts/${draftId}/thumbnails/${option}`, {
      method: "PUT",
      body: { text: value.text, design: value.design ?? {} },
      timeoutMs: SLOW_TIMEOUT_MS,
    }),
  );
}

/** Una imagen normalizada del fondo; el diseño solo guarda su identificador. */
export function uploadDraftThumbnailBackground(
  draftId: string,
  file: File,
): Promise<{ asset: string }> {
  const body = new FormData();
  body.append("file", file);
  return httpClient(`/api/v1/drafts/${draftId}/thumbnail-background`, {
    method: "POST",
    body,
    timeoutMs: 30_000,
  });
}
