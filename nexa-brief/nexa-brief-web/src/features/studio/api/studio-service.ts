import type { JobStage } from "@/features/create-video/types";
import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";
import type {
  Draft,
  DraftRequest,
  DraftStatus,
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

interface DraftDto {
  draft_id: string;
  template_id: string;
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
  updated_at: string;
}

export function mapDraft(dto: DraftDto): Draft {
  return {
    draftId: dto.draft_id,
    templateId: dto.template_id,
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
        publish_accounts: options.publishAccounts,
      },
      timeoutMs: SLOW_TIMEOUT_MS,
    },
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

export async function importStockItem(item: StockItem): Promise<StockImportResult> {
  return httpClient<StockImportResult>("/api/v1/stock/import", {
    method: "POST",
    body: {
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
