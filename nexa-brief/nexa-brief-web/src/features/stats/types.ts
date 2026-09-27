import type { ChannelPlatform } from "@/features/channels";

/** Contrato de GET /stats/public y GET /dashboard/summary — espejo de
 * src/core/stats/models.py en el backend (una interfaz por sección). */

export interface VideoStats {
  total: number;
  ready: number;
  published: number;
  processing: number;
  failed: number;
  videoSeconds: number;
}

export interface PlatformPublications {
  platform: ChannelPlatform;
  total: number;
  last7Days: number;
}

export interface PublicationStats {
  total: number;
  last30Days: number;
  byPlatform: PlatformPublications[];
}

export interface PublicChannel {
  platform: ChannelPlatform;
  name: string;
  avatar: string | null;
  publicUrl: string | null;
  publishedCount: number;
}

export interface ChannelDetail extends PublicChannel {
  alias: string;
  label: string;
  status: "ok" | "requires_reauth";
  expiresInSeconds: number | null;
  hasRefreshToken: boolean;
  lastPublishedAt: number | null;
}

export interface ChannelStats {
  total: number;
  platforms: ChannelPlatform[];
}

export interface CatalogStats {
  templates: number;
  lyricTemplates: number;
  visualTemplates: number;
  activeNiches: number;
  engines: string[];
  platformsSupported: ChannelPlatform[];
}

export interface StageTiming {
  stage: string;
  avgSeconds: number;
}

export interface PerformanceStats {
  avgGenerationSeconds: number | null;
  fastestGenerationSeconds: number | null;
  sampleSize: number;
  stages: StageTiming[];
}

export interface ShowcasePublication {
  title: string;
  platform: ChannelPlatform;
  url: string | null;
  publishedAt: number | null;
  videoUrl: string | null;
}

export interface ActivityItem {
  kind: "video_ready" | "video_failed" | "published";
  at: string;
  jobId: string | null;
  title: string;
  platform: ChannelPlatform | null;
  url: string | null;
}

export interface UpcomingPublication {
  entryId: string;
  jobId: string;
  title: string;
  platform: ChannelPlatform;
  accountAlias: string;
  scheduledAt: string;
}

export type AlertKind = "reauth" | "token_expiring" | "publish_failed" | "job_failed" | "job_stuck";

export interface DashboardAlert {
  level: "error" | "warning";
  kind: AlertKind;
  platform: ChannelPlatform | null;
  accountAlias: string | null;
  jobId: string | null;
  title: string | null;
  detail: string | null;
}

export interface PublicStats {
  videos: VideoStats;
  publications: PublicationStats;
  channels: ChannelStats;
  channelList: PublicChannel[];
  catalog: CatalogStats;
  performance: PerformanceStats;
  showcase: ShowcasePublication | null;
}

export interface DashboardSummary {
  videos: VideoStats;
  publications: PublicationStats;
  channels: ChannelStats;
  channelList: ChannelDetail[];
  catalog: CatalogStats;
  performance: PerformanceStats;
  alerts: DashboardAlert[];
  upcoming: UpcomingPublication[];
  activity: ActivityItem[];
}
