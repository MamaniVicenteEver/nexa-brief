import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";

export type LibraryAssetKind = "images" | "music" | "videos";

interface ImageAssetDto {
  asset_id: string;
  category: string;
  label: string;
  width: number;
  height: number;
}

interface MusicAssetDto {
  asset_id: string;
  category: string;
  track_name: string;
  artist: string;
  duration_seconds: number;
}

interface VideoAssetDto {
  asset_id: string;
  category: string;
  label: string;
  duration_seconds: number;
}

export interface LibraryAsset {
  assetId: string;
  category: string;
  /** Título legible: label (imagen/video) o "track_name — artist" (música). */
  title: string;
  fileUrl: string;
}

function mapImageAsset(dto: ImageAssetDto): LibraryAsset {
  return {
    assetId: dto.asset_id,
    category: dto.category,
    title: dto.label || dto.asset_id,
    fileUrl: resolveAssetFileUrl("images", dto.asset_id),
  };
}

function mapMusicAsset(dto: MusicAssetDto): LibraryAsset {
  return {
    assetId: dto.asset_id,
    category: dto.category,
    title: dto.artist ? `${dto.track_name} — ${dto.artist}` : dto.track_name || dto.asset_id,
    fileUrl: resolveAssetFileUrl("music", dto.asset_id),
  };
}

function mapVideoAsset(dto: VideoAssetDto): LibraryAsset {
  return {
    assetId: dto.asset_id,
    category: dto.category,
    title: dto.label || dto.asset_id,
    fileUrl: resolveAssetFileUrl("videos", dto.asset_id),
  };
}

export function resolveAssetFileUrl(kind: LibraryAssetKind, assetId: string): string {
  return resolveApiUrl(`/api/v1/library/${kind}/${assetId}/file`);
}

export async function getLibraryAssets(
  kind: LibraryAssetKind,
  signal?: AbortSignal,
): Promise<LibraryAsset[]> {
  if (kind === "images") {
    const dtos = await httpClient<ImageAssetDto[]>("/api/v1/library/images", { signal });
    return dtos.map(mapImageAsset);
  }
  if (kind === "music") {
    const dtos = await httpClient<MusicAssetDto[]>("/api/v1/library/music", { signal });
    return dtos.map(mapMusicAsset);
  }
  const dtos = await httpClient<VideoAssetDto[]>("/api/v1/library/videos", { signal });
  return dtos.map(mapVideoAsset);
}
