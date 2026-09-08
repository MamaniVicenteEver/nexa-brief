import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";
import type { ChannelAccount, ChannelPlatform, PublishedVideo } from "../types";

interface AccountStatusResponseDto {
  platform: string;
  alias: string;
  name: string;
  target_id: string;
  status: string;
  expires_in_seconds: number | null;
  has_refresh_token: boolean;
  avatar: string | null;
  published_count: number;
}

interface PublishedVideoResponseDto {
  platform: string;
  alias: string;
  post_id: string;
  url: string;
  title: string;
  published_at: number;
}

function mapChannelAccount(dto: AccountStatusResponseDto): ChannelAccount {
  return {
    platform: dto.platform as ChannelPlatform,
    alias: dto.alias,
    name: dto.name,
    targetId: dto.target_id,
    status: dto.status === "requires_reauth" ? "requires_reauth" : "ok",
    expiresInSeconds: dto.expires_in_seconds,
    hasRefreshToken: dto.has_refresh_token,
    avatar: dto.avatar,
    publishedCount: dto.published_count,
  };
}

function mapPublishedVideo(dto: PublishedVideoResponseDto): PublishedVideo {
  return {
    platform: dto.platform as ChannelPlatform,
    alias: dto.alias,
    postId: dto.post_id,
    url: dto.url,
    title: dto.title,
    publishedAt: dto.published_at,
  };
}

export async function getChannels(signal?: AbortSignal): Promise<ChannelAccount[]> {
  const dtos = await httpClient<AccountStatusResponseDto[]>("/api/v1/publish/accounts", {
    signal,
  });
  return dtos.map(mapChannelAccount);
}

export async function getChannelVideos(
  platform: ChannelPlatform,
  alias: string,
  signal?: AbortSignal,
): Promise<PublishedVideo[]> {
  const dtos = await httpClient<PublishedVideoResponseDto[]>(
    `/api/v1/publish/accounts/${platform}/${encodeURIComponent(alias)}/videos`,
    { signal },
  );
  return dtos.map(mapPublishedVideo);
}

export async function disconnectChannel(platform: ChannelPlatform, alias: string): Promise<void> {
  await httpClient<void>(`/api/v1/publish/accounts/${platform}/${encodeURIComponent(alias)}`, {
    method: "DELETE",
  });
}

/** Full-page redirect target — not a fetch call, the browser must navigate
 * here so the platform's OAuth consent screen can redirect back to it. */
export function buildConnectChannelUrl(platform: ChannelPlatform, alias: string): string {
  const params = new URLSearchParams({ alias });
  return resolveApiUrl(`/api/v1/publish/auth/${platform}/start?${params.toString()}`);
}
