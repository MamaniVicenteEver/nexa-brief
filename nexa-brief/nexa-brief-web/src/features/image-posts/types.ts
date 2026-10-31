export type ImageTemplateId = "daily_fact" | "five_slides";
export type ImagePostKind = "image" | "carousel";
export type ImagePostStatus =
  | "draft"
  | "rendering"
  | "rendered"
  | "ready_for_review"
  | "approved"
  | "scheduled"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled"
  | "removed"
  | "removal_pending_manual";
export type DeliveryStatus =
  | "draft"
  | "queued"
  | "publishing"
  | "published"
  | "failed_retryable"
  | "failed_permanent"
  | "outcome_unknown"
  | "cancelled"
  | "removed_api"
  | "removed_manually"
  | "removed"
  | "removal_pending_manual";
export type Platform = "facebook" | "instagram";
export type Placement = "image" | "carousel" | "reel";
export type MusicMode = "none" | "convert_to_reel";
export type GalleryKind = "image" | "carousel" | "story" | "reel";
export type MetricName =
  | "reach"
  | "impressions"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "plays";
export type MetricsWindow = "48h" | "7d";

export interface StyleOption {
  styleId: string;
  categoryId: string;
  version: string;
  designId: string;
  label: string;
  isDemo?: boolean;
}

export interface ImageStrategy {
  id: string;
  name: string;
  description: string;
  goal: string;
  templateId: ImageTemplateId;
  factsNeeded: number;
}

export interface AccountCapability {
  platform: Platform;
  alias: string;
  name: string;
  canPublish: boolean;
  canComment: boolean;
  canInsights: boolean;
  igAccountSubtype: string | null;
  timezone?: string | null;
}

export interface Capabilities {
  accounts: AccountCapability[];
  reviewRequired: boolean;
  isDemo?: boolean;
}

export interface ImageCopyBlock {
  caption: string;
  firstComment: string;
}

export interface ImageCopy {
  facebook: ImageCopyBlock;
  instagram: ImageCopyBlock;
  hashtags: string[];
}

export interface ImageSlide {
  slideId: string;
  order: number;
  assetId: string;
  altTextFacebook: string;
  altTextInstagram: string;
  previewUrl: string | null;
}

export interface RemoteResult {
  photoIds: string[];
  childContainerIds: string[];
  parentContainerId: string | null;
  postId: string | null;
  permalink: string | null;
  commentId: string | null;
}

export interface ImageDelivery {
  deliveryId: string;
  revision: number;
  platform: Platform;
  accountAlias: string;
  targetId: string | null;
  placement: Placement;
  scheduledAt: string | null;
  timezone?: string | null;
  status: DeliveryStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  remote: RemoteResult;
  lastError: string | null;
  publishedAt: string | null;
  commentStatus: "not_requested" | "pending" | "published" | "skipped_permission" | "failed";
  isDemo?: boolean;
}

export interface MusicOption {
  mode: MusicMode;
  musicAssetId?: string;
  sourceSha256?: string;
  license?: {
    spdxOrName: string;
    url: string;
    author: string;
    trackUrl: string;
    attribution: string;
    proofRef: string;
  };
  trimStartSec?: number;
  durationSec?: number;
  gainDb?: number;
  selection?: "manual" | "auto_licensed";
}

export interface ImagePost {
  postId: string;
  categoryId: string;
  sourceVideoId: string;
  planId: string;
  planHash: string;
  kind: ImagePostKind;
  templateId: ImageTemplateId;
  strategyId: string | null;
  styleId: string;
  title: string;
  copy: ImageCopy;
  slides: ImageSlide[];
  music: MusicOption;
  reviewRequired: boolean;
  status: ImagePostStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  sourceTitle?: string;
  validationErrors: string[];
  validationWarnings: string[];
  deliveries: ImageDelivery[];
  renderSeconds: number | null;
  isDemo?: boolean;
}

export interface PlanSlide {
  slide_id: string;
  order: number;
  layout: string;
  elements: Array<Record<string, unknown>>;
  texts: Array<Record<string, unknown>>;
  media: Array<Record<string, unknown>>;
  claim_refs: Array<Record<string, unknown>>;
}

export interface ImagePlan {
  plan_id: string;
  category_id: string;
  source_video_id: string;
  source_revision: string;
  style_id: string;
  style_version: string;
  template_id: ImageTemplateId;
  format: "4:5";
  slides: PlanSlide[];
  seed: number;
  renderer_version: string;
}

export interface PlanValidation {
  errors: string[];
  warnings: string[];
}

export interface DeliverySummary {
  deliveryId: string;
  platform: Platform;
  accountAlias: string;
  placement: Placement;
  status: DeliveryStatus;
  publishedAt: string | null;
  permalink: string | null;
  metricValue: number | null;
  metricName: MetricName | null;
  window: MetricsWindow | null;
  commentStatus?: ImageDelivery["commentStatus"];
}

export interface PublicationDeliveryDetail extends DeliverySummary {
  scheduledAt: string | null;
  timezone: string | null;
  lastError: string | null;
  remote: RemoteResult;
  targetId: string | null;
  removedAt: string | null;
  removalReason: string | null;
  removalInstruction: string | null;
  removalGraphResponse: Record<string, unknown> | null;
}

export interface PublicationSummary {
  publicationId: string;
  categoryId: string;
  categoryName: string;
  topic: string;
  title: string;
  kind: GalleryKind;
  templateId: string;
  strategyId: string | null;
  status: ImagePostStatus | "removed_api" | "removed_manually";
  createdAt: string;
  latestPublishedAt: string | null;
  coverAssetId: string | null;
  coverUrl: string | null;
  slides: Array<{
    slideId: string;
    assetId: string;
    order: number;
    previewUrl: string | null;
    altTextFacebook: string;
    altTextInstagram: string;
  }>;
  deliveries: DeliverySummary[];
  isDemo?: boolean;
}

export interface MetricSnapshot {
  snapshotId: string;
  deliveryId: string;
  window: MetricsWindow;
  observedAt: string;
  metrics: Partial<Record<MetricName, number | null>> | null;
  status: string;
}

export interface PublicationTechnical {
  renderSeconds: number | null;
  rendererVersion: string | null;
  planHash: string | null;
  styleId: string | null;
  styleVersion: string | null;
  validations: Array<{ name: string; passed: boolean; details?: Record<string, unknown> }>;
  slides: Array<{
    assetId: string;
    slideId: string;
    order: number;
    mime: string;
    width: number | null;
    height: number | null;
    aspectRatio: string | null;
    bytes: number | null;
    colorProfile: string | null;
    sha256: string | null;
    previewUrl: string | null;
  }>;
  music: MusicOption;
  aiUsage: Array<{
    provider: string;
    model: string;
    role: string;
    inputTokens: number | null;
    outputTokens: number | null;
    reasoningTokens: number | null;
    cachedInputTokens: number | null;
    totalTokens: number | null;
    seconds: number | null;
  }>;
  copySources: Record<string, string>;
  reel: null | {
    assetId: string;
    previewUrl: string | null;
    bytes: number | null;
    sha256: string | null;
    durationSec: number | null;
    codec: string | null;
    audioCodec: string | null;
    fps: number | null;
  };
}

export interface PublicationDetail extends PublicationSummary {
  sourceVideoId: string | null;
  sourceVideoUrl: string | null;
  sources: Array<{ title: string; url: string; locator: string }>;
  copy: ImageCopy;
  technical: PublicationTechnical;
  deliveries: PublicationDeliveryDetail[];
  metricsSnapshots: MetricSnapshot[];
  reviewRequired: boolean;
  isDemo?: boolean;
}

export interface GalleryFilters {
  categoryId: string;
  platform: "all" | Platform;
  kind: "all" | GalleryKind;
  strategyId: "all" | string;
  status: "all" | string;
  metric: MetricName;
  window: MetricsWindow;
  sort: "desc" | "asc";
}

export interface ImagePostPatch {
  revision: number;
  title: string;
  copy: ImageCopy;
  slides: Array<{ slide_id: string; alt_text_fb: string; alt_text_ig: string }>;
  music: MusicOption;
  review_required: boolean;
}

export interface CreatePlanInput {
  category_id: string;
  source_video_id: string;
  template_id: ImageTemplateId;
  strategy_id?: string;
  style_id: string;
  seed?: number;
}

export interface DeliveryTargetInput {
  platform: Platform;
  account_alias: string;
  placement: Placement;
  scheduled_at?: string;
}
