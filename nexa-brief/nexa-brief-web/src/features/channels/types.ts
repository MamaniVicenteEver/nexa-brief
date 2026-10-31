export type ChannelPlatform = "youtube" | "tiktok" | "facebook" | "instagram";

export type ChannelStatus = "ok" | "requires_reauth";
export type ChannelMode = "api" | "service";

export interface ChannelStats {
  videoCount: number | null;
  followers: number | null;
  views: number | null;
}

export interface VideoMetrics {
  views: number | null;
  likes: number | null;
  comments: number | null;
  syncedAt: number | null;
}

export interface ChannelAccount {
  platform: ChannelPlatform;
  alias: string;
  name: string;
  targetId: string;
  status: ChannelStatus;
  mode: ChannelMode;
  lastSessionCheck: number | null;
  expiresInSeconds: number | null;
  hasRefreshToken: boolean;
  avatar: string | null;
  handle: string | null;
  description: string;
  customUrl: string | null;
  profileSyncedAt: number | null;
  linkedPageName: string | null;
  linkedPageId: string | null;
  publishedCount: number;
  stats: ChannelStats | null;
  syncedAt: number | null;
  canSync: boolean;
  /** User-defined purpose ("Letras románticas", "Clientes"…); empty when unset. */
  label: string;
  notes: string;
  /** Unix seconds. */
  connectedAt: number | null;
  /** Unix seconds. */
  lastPublishedAt: number | null;
}

export interface ChannelAccountUpdate {
  label?: string;
  notes?: string;
}

export interface PublishedVideo {
  platform: ChannelPlatform;
  alias: string;
  postId: string;
  url: string;
  title: string;
  publishedAt: number;
  origin: "nexa" | "imported";
  privacy: string | null;
  kind: "video" | "short" | "reel" | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  metrics: VideoMetrics | null;
}

export interface ChannelSyncResult {
  platform: ChannelPlatform;
  alias: string;
  remoteTotal: number;
  imported: number;
  updated: number;
  stats: ChannelStats;
  syncedAt: number;
}
