import { httpClient } from "@/infrastructure/api/http-client";
import type {
  SandboxFolder,
  SandboxInfo,
  SandboxItem,
  SandboxKind,
  SandboxModelUsage,
  SandboxPlayer,
  SandboxRole,
} from "../types";

interface SandboxItemDto {
  id: string;
  folder: string;
  subcategory?: string | null;
  path: string;
  kind: SandboxKind;
  title: string;
  status: string | null;
  design: string | null;
  has_index: boolean;
  has_poster: boolean;
  has_info: boolean;
  total_tokens: number | null;
  thumbnail_url: string | null;
  player: SandboxPlayer;
  videos: string[];
  notes_file: string | null;
  updated_at: string | null;
  promotable: boolean;
  promote_blocker: string | null;
}

interface SandboxFolderDto {
  folder: string;
  label: string;
  role?: SandboxRole;
  category_id: string | null;
  items: SandboxItemDto[];
}

interface SandboxInfoDto {
  info: SandboxInfo["info"];
  totals_by_model: Array<{
    provider: string;
    model: string;
    input_tokens: number;
    cached_input_tokens: number;
    fresh_input_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;
    total_tokens: number;
  }>;
  total_tokens: number;
  cached_tokens: number;
  estimated: boolean;
  baseline: { id: string; total_tokens: number } | null;
  ratio_vs_baseline: number | null;
  forecast_next: { min: number; max: number; basis: string } | null;
  verdict: SandboxInfo["verdict"];
}

interface PromoteSandboxItemDto {
  video_id: string;
  from_path: string;
  to_path: string;
  category_path: string | null;
}

export interface PromoteSandboxItemResult {
  videoId: string;
  fromPath: string;
  toPath: string;
  categoryPath: string | null;
}

function mapSandboxItem(dto: SandboxItemDto): SandboxItem {
  return {
    id: dto.id,
    folder: dto.folder,
    subcategory: dto.subcategory ?? null,
    path: dto.path,
    kind: dto.kind,
    title: dto.title,
    status: dto.status,
    design: dto.design,
    hasIndex: dto.has_index,
    hasPoster: dto.has_poster,
    hasInfo: dto.has_info,
    totalTokens: dto.total_tokens,
    thumbnailUrl: dto.thumbnail_url,
    player: dto.player,
    videos: dto.videos,
    notesFile: dto.notes_file,
    updatedAt: dto.updated_at,
    promotable: dto.promotable,
    promoteBlocker: dto.promote_blocker,
  };
}

function mapSandboxFolder(dto: SandboxFolderDto): SandboxFolder {
  return {
    folder: dto.folder,
    label: dto.label,
    role:
      dto.role ??
      (dto.folder === "referencias" || dto.folder === "nuevos" ? "references" : "projects"),
    categoryId: dto.category_id,
    items: dto.items.map(mapSandboxItem),
  };
}

function mapPromoteSandboxItem(dto: PromoteSandboxItemDto): PromoteSandboxItemResult {
  return {
    videoId: dto.video_id,
    fromPath: dto.from_path,
    toPath: dto.to_path,
    categoryPath: dto.category_path,
  };
}

export async function fetchSandbox(signal?: AbortSignal): Promise<SandboxFolder[]> {
  const folders = await httpClient<SandboxFolderDto[]>("/api/v1/explainer/sandbox", { signal });
  return folders.map(mapSandboxFolder);
}

function mapSandboxInfo(dto: SandboxInfoDto): SandboxInfo {
  const totalsByModel: SandboxModelUsage[] = dto.totals_by_model.map((row) => ({
    provider: row.provider,
    model: row.model,
    inputTokens: row.input_tokens,
    cachedInputTokens: row.cached_input_tokens,
    freshInputTokens: row.fresh_input_tokens,
    outputTokens: row.output_tokens,
    reasoningTokens: row.reasoning_tokens,
    totalTokens: row.total_tokens,
  }));
  return {
    info: dto.info,
    totalsByModel,
    totalTokens: dto.total_tokens,
    cachedTokens: dto.cached_tokens,
    estimated: dto.estimated,
    baseline: dto.baseline ? { id: dto.baseline.id, totalTokens: dto.baseline.total_tokens } : null,
    ratioVsBaseline: dto.ratio_vs_baseline,
    forecastNext: dto.forecast_next,
    verdict: dto.verdict,
  };
}

export async function fetchSandboxInfo(
  folder: string,
  id: string,
  signal?: AbortSignal,
): Promise<SandboxInfo> {
  const dto = await httpClient<SandboxInfoDto>(
    `/api/v1/explainer/sandbox/${encodeURIComponent(folder)}/${encodeURIComponent(id)}/info`,
    { signal },
  );
  return mapSandboxInfo(dto);
}

export async function promoteSandboxItem(
  folder: string,
  id: string,
): Promise<PromoteSandboxItemResult> {
  const dto = await httpClient<PromoteSandboxItemDto>(
    `/api/v1/explainer/sandbox/${encodeURIComponent(folder)}/${encodeURIComponent(id)}/promote`,
    { method: "POST" },
  );
  return mapPromoteSandboxItem(dto);
}
