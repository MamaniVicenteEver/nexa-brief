import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";
import type {
  ResearchCard,
  ResearchCounts,
  ResearchDetail,
  ResearchFinding,
  ResearchPage,
  ResearchPageParams,
  ResearchSyncReport,
} from "../domain/research";
import type { ResearchAssetsPort } from "../ports/research-port";

/** DTO del backend (snake_case). Solo este archivo los conoce. */
interface CountsDto {
  findings: number;
  sources: number;
  discarded: number;
  images: number;
  files: number;
  videos: number;
}

interface CardDto {
  research_id: string;
  topic: string;
  researched_at: string;
  origin_root: string;
  origin_category: string;
  origin_video_id: string;
  origin_path: string;
  revision: string;
  version_count: number;
  tags: string[];
  counts: CountsDto;
  cover_url: string | null;
}

interface PageDto {
  items: CardDto[];
  total: number;
  page: number;
  page_size: number;
}

interface FindingDto {
  id: string;
  claim: string;
  strength: number | null;
  recency: string;
  sources: { title: string; url: string; data_date: string; accessed_at: string }[];
}

interface DetailDto extends Omit<CardDto, "version_count" | "cover_url"> {
  summary: string;
  findings: FindingDto[];
  discarded: { claim: string; reason: string }[];
  images: { path: string; url: string; source_url: string; license: string; credit: string }[];
  files: { path: string; url: string; bytes: number }[];
  versions: { research_id: string; revision: string; researched_at: string; topic: string }[];
  used_by: { video_id: string; at: string }[];
}

interface SyncDto {
  folders: number;
  created: number;
  merged: number;
  skipped: number;
  errors: string[];
}

export function mapResearchCounts(dto: CountsDto): ResearchCounts {
  return {
    findings: dto.findings,
    sources: dto.sources,
    discarded: dto.discarded,
    images: dto.images,
    files: dto.files,
    videos: dto.videos,
  };
}

export function mapResearchCard(dto: CardDto): ResearchCard {
  return {
    id: dto.research_id,
    topic: dto.topic,
    researchedAt: dto.researched_at,
    originRoot: dto.origin_root,
    originCategory: dto.origin_category,
    originVideoId: dto.origin_video_id,
    originPath: dto.origin_path,
    revision: dto.revision,
    versionCount: dto.version_count,
    tags: dto.tags,
    counts: mapResearchCounts(dto.counts),
    coverUrl: dto.cover_url ? resolveApiUrl(dto.cover_url) : null,
  };
}

function mapFindings(findings: FindingDto[]): ResearchFinding[] {
  return findings.map((finding) => ({
    id: finding.id,
    claim: finding.claim,
    strength: finding.strength,
    recency: finding.recency,
    sources: finding.sources.map((source) => ({
      title: source.title,
      url: source.url,
      dataDate: source.data_date,
      accessedAt: source.accessed_at,
    })),
  }));
}

export function mapResearchDetail(dto: DetailDto): ResearchDetail {
  return {
    id: dto.research_id,
    topic: dto.topic,
    researchedAt: dto.researched_at,
    originRoot: dto.origin_root,
    originCategory: dto.origin_category,
    originVideoId: dto.origin_video_id,
    originPath: dto.origin_path,
    revision: dto.revision,
    tags: dto.tags,
    counts: mapResearchCounts(dto.counts),
    summary: dto.summary,
    findings: mapFindings(dto.findings),
    discarded: dto.discarded.map((item) => ({ claim: item.claim, reason: item.reason })),
    images: dto.images.map((image) => ({
      path: image.path,
      url: resolveApiUrl(image.url),
      sourceUrl: image.source_url,
      license: image.license,
      credit: image.credit,
    })),
    files: dto.files.map((file) => ({
      path: file.path,
      url: resolveApiUrl(file.url),
      bytes: file.bytes,
    })),
    versions: dto.versions.map((version) => ({
      id: version.research_id,
      revision: version.revision,
      researchedAt: version.researched_at,
      topic: version.topic,
    })),
    usedBy: dto.used_by.map((usage) => ({ videoId: usage.video_id, at: usage.at })),
  };
}

async function getResearchPage(
  params: ResearchPageParams,
  signal?: AbortSignal,
): Promise<ResearchPage> {
  const search = new URLSearchParams();
  const q = params.q?.trim();
  if (q) search.set("q", q);
  if (params.category) search.set("category", params.category);
  search.set("page", String(params.page ?? 1));
  search.set("page_size", String(params.pageSize ?? 12));
  const dto = await httpClient<PageDto>(`/api/v1/library/research?${search.toString()}`, {
    signal,
  });
  return {
    items: dto.items.map(mapResearchCard),
    total: dto.total,
    page: dto.page,
    pageSize: dto.page_size,
  };
}

async function getResearchCategories(signal?: AbortSignal): Promise<string[]> {
  return httpClient<string[]>("/api/v1/library/research/categories", { signal });
}

async function getResearchDetail(
  researchId: string,
  signal?: AbortSignal,
): Promise<ResearchDetail> {
  const dto = await httpClient<DetailDto>(`/api/v1/library/research/${researchId}`, { signal });
  return mapResearchDetail(dto);
}

async function syncResearch(): Promise<ResearchSyncReport> {
  const dto = await httpClient<SyncDto>("/api/v1/library/research/sync", {
    method: "POST",
    body: {},
  });
  return {
    folders: dto.folders,
    created: dto.created,
    merged: dto.merged,
    skipped: dto.skipped,
    errors: dto.errors,
  };
}

export const httpResearchAdapter: ResearchAssetsPort = {
  page: getResearchPage,
  categories: getResearchCategories,
  get: getResearchDetail,
  sync: syncResearch,
};
