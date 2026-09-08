export type ChannelPlatform = "youtube" | "tiktok" | "facebook";

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
  publishedCount: number;
}

export interface PublishedVideo {
  platform: ChannelPlatform;
  alias: string;
  postId: string;
  url: string;
  title: string;
  publishedAt: number;
}
