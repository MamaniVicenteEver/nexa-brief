import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";
import type {
  ChannelAccount,
  ChannelAccountUpdate,
  ChannelPlatform,
  PublishedVideo,
} from "../types";

interface AccountStatusResponseDto {
  platform: string;
  alias: string;
  name: string;
  target_id: string;
  status: string;
  expires_in_seconds: number | null;
  has_refresh_token: boolean;
  avatar: string | null;
  handle?: string | null;
  description?: string;
  custom_url?: string | null;
  profile_synced_at?: number | null;
  linked_page_name?: string | null;
  linked_page_id?: string | null;
  published_count: number;
  label?: string;
  notes?: string;
  connected_at?: number | null;
  last_published_at?: number | null;
}

interface PublishedVideoResponseDto {
  platform: string;
  alias: string;
  post_id: string;
  url: string;
  title: string;
  published_at: number;
}

export interface ChannelHealthResult {
  platform: ChannelPlatform;
  alias: string;
  status: "ok" | "requires_reauth" | "attention";
  reason:
    | "connected"
    | "reauth_required"
    | "identity_mismatch"
    | "permissions"
    | "unavailable"
    | "check_failed";
  checked_at: number;
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
    handle: dto.handle ?? null,
    description: dto.description ?? "",
    customUrl: dto.custom_url ?? null,
    profileSyncedAt: dto.profile_synced_at ?? null,
    linkedPageName: dto.linked_page_name ?? null,
    linkedPageId: dto.linked_page_id ?? null,
    publishedCount: dto.published_count,
    label: dto.label ?? "",
    notes: dto.notes ?? "",
    connectedAt: dto.connected_at ?? null,
    lastPublishedAt: dto.last_published_at ?? null,
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
    `${accountPath(platform, alias)}/videos`,
    { signal },
  );
  // The publish log can hold the same post twice (e.g. a retried publish) — keep the first (newest).
  const unique = new Map<string, PublishedVideo>();
  for (const dto of dtos)
    if (!unique.has(dto.post_id)) unique.set(dto.post_id, mapPublishedVideo(dto));
  return [...unique.values()];
}

function accountPath(platform: ChannelPlatform, alias: string): string {
  return `/api/v1/publish/accounts/${platform}/${encodeURIComponent(alias)}`;
}

export async function updateChannel(
  platform: ChannelPlatform,
  alias: string,
  update: ChannelAccountUpdate,
): Promise<ChannelAccount> {
  const dto = await httpClient<AccountStatusResponseDto>(accountPath(platform, alias), {
    method: "PATCH",
    body: update,
  });
  return mapChannelAccount(dto);
}

export async function refreshChannelProfile(
  platform: ChannelPlatform,
  alias: string,
): Promise<ChannelAccount> {
  const dto = await httpClient<AccountStatusResponseDto>(
    accountPath(platform, alias) + "/refresh-profile",
    { method: "POST" },
  );
  return mapChannelAccount(dto);
}

export async function verifyChannelConnection(
  platform: ChannelPlatform,
  alias: string,
): Promise<ChannelHealthResult> {
  return httpClient<ChannelHealthResult>(accountPath(platform, alias) + "/verify", {
    method: "POST",
    timeoutMs: 30_000,
  });
}

export async function disconnectChannel(platform: ChannelPlatform, alias: string): Promise<void> {
  await httpClient<void>(accountPath(platform, alias), { method: "DELETE" });
}

/** Full-page redirect target — not a fetch call, the browser must navigate
 * here so the platform's OAuth consent screen can redirect back to it. */
export function buildConnectChannelUrl(platform: ChannelPlatform, alias: string): string {
  const params = new URLSearchParams({ alias });
  return resolveApiUrl(`/api/v1/publish/auth/${platform}/start?${params.toString()}`);
}

/** Borra el post de la plataforma (irreversible). El backend también lo saca
 * del log de publicaciones y marca `removed` sus entries de cola. */
export async function deletePublishedVideo(
  platform: ChannelPlatform,
  alias: string,
  postId: string,
): Promise<void> {
  await httpClient(
    `/api/v1/publish/${platform}/${encodeURIComponent(alias)}/${encodeURIComponent(postId)}`,
    { method: "DELETE", timeoutMs: 60_000 },
  );
}
