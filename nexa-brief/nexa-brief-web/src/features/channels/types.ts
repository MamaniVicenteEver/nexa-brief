export type ChannelPlatform = "youtube" | "tiktok" | "facebook" | "instagram";

export type ChannelStatus = "ok" | "requires_reauth";

export interface ChannelAccount {
  platform: ChannelPlatform;
  alias: string;
  name: string;
  targetId: string;
  status: ChannelStatus;
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
}
