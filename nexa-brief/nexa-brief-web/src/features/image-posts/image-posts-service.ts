import { ApiError } from "@/infrastructure/api/api-error";
import {
  cancelImageDelivery,
  createImageDeliveries,
  createImagePlan,
  fetchImageCapabilities,
  fetchImageDelivery,
  fetchImagePost,
  fetchImagePosts,
  fetchImageStrategies,
  fetchImageStyles,
  imagePostAssetUrl,
  patchImagePost,
  publishImageDelivery,
  reconcileImageDelivery,
  renderImagePlan,
  reviewImagePost as requestImagePostReview,
} from "./api/image-posts-api";
import {
  fetchPublication,
  fetchPublicationAssetUrl,
  fetchPublicationMetrics,
  fetchPublications,
  removePublication,
} from "./api/publications-api";
import { publicationFormat } from "./gallery-utils";
import type {
  AccountCapability,
  Capabilities,
  DeliveryStatus,
  GalleryFilters,
  ImageCopy,
  ImageDelivery,
  ImagePlan,
  ImagePost,
  ImagePostPatch,
  ImagePostStatus,
  ImageStrategy,
  MetricName,
  MetricSnapshot,
  MetricsWindow,
  MusicOption,
  Placement,
  Platform,
  PublicationDeliveryDetail,
  PublicationDetail,
  PublicationSummary,
  RemoteResult,
  StyleOption,
} from "./types";

type Dict = Record<string, unknown>;

function asObject(value: unknown): Dict {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Dict) : {};
}

function get(value: unknown, ...keys: string[]): unknown {
  const object = asObject(value);
  for (const key of keys) if (object[key] !== undefined) return object[key];
  return undefined;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function castPlatform(value: unknown): Platform {
  return value === "instagram" ? "instagram" : "facebook";
}

function castPlacement(value: unknown): Placement {
  return value === "carousel" || value === "reel" ? value : "image";
}

function castPostStatus(value: unknown): ImagePostStatus {
  const statuses: ImagePostStatus[] = [
    "draft",
    "rendering",
    "rendered",
    "ready_for_review",
    "approved",
    "scheduled",
    "completed",
    "partial",
    "failed",
    "cancelled",
    "removed",
    "removal_pending_manual",
  ];
  const candidate = text(value, "draft") as ImagePostStatus;
  return statuses.includes(candidate) ? candidate : "draft";
}

function castDeliveryStatus(value: unknown): DeliveryStatus {
  const statuses: DeliveryStatus[] = [
    "draft",
    "queued",
    "publishing",
    "published",
    "failed_retryable",
    "failed_permanent",
    "outcome_unknown",
    "cancelled",
    "removed_api",
    "removed_manually",
    "removed",
    "removal_pending_manual",
  ];
  const candidate = text(value, "draft") as DeliveryStatus;
  return statuses.includes(candidate) ? candidate : "draft";
}

function mapCopyBlock(value: unknown) {
  return {
    caption: text(get(value, "caption")),
    firstComment: text(get(value, "first_comment", "firstComment")),
  };
}

function mapCopy(value: unknown): ImageCopy {
  return {
    facebook: mapCopyBlock(get(value, "facebook")),
    instagram: mapCopyBlock(get(value, "instagram")),
    hashtags: list(get(value, "hashtags")).filter((tag): tag is string => typeof tag === "string"),
  };
}

function mapMusic(value: unknown): MusicOption {
  const mode = get(value, "mode");
  if (mode !== "convert_to_reel") return { mode: "none" };
  const license = get(value, "license");
  const mapped: MusicOption = {
    mode,
    musicAssetId: text(get(value, "music_asset_id", "musicAssetId")),
    sourceSha256: text(get(value, "source_sha256", "sourceSha256")),
    trimStartSec: number(get(value, "trim_start_sec", "trimStartSec")) ?? undefined,
    durationSec: number(get(value, "duration_sec", "durationSec")) ?? undefined,
    gainDb: number(get(value, "gain_db", "gainDb")) ?? undefined,
    selection: get(value, "selection") === "auto_licensed" ? "auto_licensed" : "manual",
  };
  if (license) {
    mapped.license = {
      spdxOrName: text(get(license, "spdx_or_name", "spdxOrName")),
      url: text(get(license, "url")),
      author: text(get(license, "author")),
      trackUrl: text(get(license, "track_url", "trackUrl")),
      attribution: text(get(license, "attribution")),
      proofRef: text(get(license, "proof_ref", "proofRef")),
    };
  }
  return mapped;
}

function mapRemote(value: unknown): RemoteResult {
  return {
    photoIds: list(get(value, "photo_ids", "photoIds")).filter(
      (item): item is string => typeof item === "string",
    ),
    childContainerIds: list(get(value, "child_container_ids", "childContainerIds")).filter(
      (item): item is string => typeof item === "string",
    ),
    parentContainerId: nullableText(get(value, "parent_container_id", "parentContainerId")),
    postId: nullableText(get(value, "post_id", "postId")),
    permalink: nullableText(get(value, "permalink")),
    commentId: nullableText(get(value, "comment_id", "commentId")),
  };
}

function mapDelivery(value: unknown): ImageDelivery {
  const raw = asObject(value);
  const commentStatus = get(raw, "comment_status", "commentStatus");
  const allowedCommentStatuses: ImageDelivery["commentStatus"][] = [
    "not_requested",
    "pending",
    "published",
    "skipped_permission",
    "failed",
  ];
  const normalizedCommentStatus = allowedCommentStatuses.includes(
    commentStatus as ImageDelivery["commentStatus"],
  )
    ? (commentStatus as ImageDelivery["commentStatus"])
    : "not_requested";
  return {
    deliveryId: text(get(raw, "delivery_id", "deliveryId")),
    revision: number(get(raw, "revision")) ?? 1,
    platform: castPlatform(get(raw, "platform")),
    accountAlias: text(get(raw, "account_alias", "accountAlias")),
    targetId: nullableText(get(raw, "target_id", "targetId")),
    placement: castPlacement(get(raw, "placement")),
    scheduledAt: nullableText(get(raw, "scheduled_at", "scheduledAt")),
    timezone: nullableText(get(raw, "timezone")),
    status: castDeliveryStatus(get(raw, "status")),
    attemptCount: number(get(raw, "attempt_count", "attemptCount")) ?? 0,
    nextAttemptAt: nullableText(get(raw, "next_attempt_at", "nextAttemptAt")),
    remote: mapRemote(get(raw, "remote")),
    lastError: nullableText(
      get(get(raw, "last_error", "lastError"), "message") ?? get(raw, "last_error", "lastError"),
    ),
    publishedAt: nullableText(get(raw, "published_at", "publishedAt")),
    commentStatus: normalizedCommentStatus,
    isDemo: get(raw, "is_demo", "isDemo") === true,
  };
}

function mapStyle(value: unknown, categoryId: string): StyleOption {
  return {
    styleId: text(get(value, "style_id", "styleId")),
    categoryId: text(get(value, "category_id", "categoryId"), categoryId),
    version: text(get(value, "version")),
    designId: text(get(value, "design_id", "designId")),
    label: text(get(value, "label"), text(get(value, "design_id", "designId"), "Estilo")),
  };
}

function mapAccount(value: unknown): AccountCapability {
  return {
    platform: castPlatform(get(value, "platform")),
    alias: text(get(value, "alias", "account_alias")),
    name: text(get(value, "name"), text(get(value, "alias", "account_alias"))),
    canPublish: get(value, "can_publish", "canPublish") === true,
    canComment: get(value, "can_comment", "canComment") === true,
    canInsights: get(value, "can_insights", "canInsights") === true,
    igAccountSubtype: nullableText(get(value, "ig_account_subtype", "igAccountSubtype")),
    timezone: nullableText(get(value, "timezone")),
  };
}

function mapImagePost(value: unknown): ImagePost {
  const raw = asObject(get(value, "post", "image_post") ?? value);
  const technical = asObject(get(raw, "technical"));
  const editorial = asObject(get(raw, "editorial"));
  const plan = asObject(get(raw, "plan") ?? get(technical, "composition_plan"));
  const validation = asObject(get(raw, "validation"));
  const previewUrls = asObject(get(raw, "preview_urls", "previewUrls"));
  const editorialSlides = list(get(editorial, "slides"));
  const slides = list(get(raw, "slides") ?? get(technical, "slides")).map((item, index) => {
    const assetId = text(get(item, "asset_id", "assetId"));
    const slideId = text(get(item, "slide_id", "slideId"), `slide-${index + 1}`);
    const editorialSlide = editorialSlides.find(
      (candidate) => get(candidate, "slide_id", "slideId") === slideId,
    );
    return {
      slideId,
      order: number(get(item, "order")) ?? index + 1,
      assetId,
      altTextFacebook: text(
        get(item, "alt_text_fb", "altTextFacebook") ?? get(editorialSlide, "alt_text_fb"),
      ),
      altTextInstagram: text(
        get(item, "alt_text_ig", "altTextInstagram") ?? get(editorialSlide, "alt_text_ig"),
      ),
      previewUrl:
        nullableText(get(item, "preview_url", "previewUrl")) ??
        nullableText(previewUrls[assetId]) ??
        (assetId ? imagePostAssetUrl(text(get(raw, "post_id", "postId")), assetId) : null),
    };
  });
  const templateId =
    (get(raw, "template_id", "templateId") ?? get(technical, "template_id")) === "five_slides"
      ? "five_slides"
      : "daily_fact";
  const validationErrors = list(get(validation, "errors", "validation_errors", "validationErrors"))
    .map((item) => (typeof item === "string" ? item : text(get(item, "message", "msg"))))
    .filter(Boolean);
  const validationWarnings = list(
    get(validation, "warnings", "validation_warnings", "validationWarnings"),
  )
    .map((item) => (typeof item === "string" ? item : text(get(item, "message", "msg"))))
    .filter(Boolean);
  return {
    postId: text(get(raw, "post_id", "postId")),
    categoryId: text(get(raw, "category_id", "categoryId") ?? get(editorial, "category_id")),
    sourceVideoId: text(
      get(raw, "source_video_id", "sourceVideoId") ?? get(editorial, "source_video_id"),
    ),
    sourceTitle:
      nullableText(get(raw, "source_title", "sourceTitle") ?? get(editorial, "topic")) ?? undefined,
    planId: text(get(raw, "plan_id", "planId"), text(get(plan, "plan_id", "planId"))),
    planHash: text(get(raw, "plan_hash", "planHash") ?? get(plan, "plan_hash")),
    kind: (get(raw, "kind") ?? get(technical, "kind")) === "carousel" ? "carousel" : "image",
    templateId,
    strategyId: nullableText(get(editorial, "strategy_id", "strategyId")),
    styleId: text(get(raw, "style_id", "styleId"), text(get(plan, "style_id", "styleId"))),
    title: text(get(raw, "title") ?? get(editorial, "title")),
    copy: mapCopy(get(raw, "copy") ?? get(editorial, "copy")),
    slides,
    music: mapMusic(get(raw, "music") ?? get(technical, "music")),
    reviewRequired:
      (get(raw, "review_required", "reviewRequired") ??
        get(get(editorial, "review"), "required")) !== false,
    status: castPostStatus(get(raw, "status")),
    revision: number(get(raw, "revision")) ?? 1,
    createdAt: text(get(raw, "created_at", "createdAt")),
    updatedAt: text(get(raw, "updated_at", "updatedAt")),
    validationErrors,
    validationWarnings,
    deliveries: list(get(raw, "deliveries")).map(mapDelivery),
    renderSeconds: number(
      get(raw, "render_seconds", "renderSeconds", "render_duration_seconds") ??
        get(get(technical, "render"), "duration_seconds"),
    ),
    isDemo: get(raw, "is_demo", "isDemo") === true,
  };
}

function mapPlanResponse(value: unknown) {
  const rawPlan = asObject(get(value, "plan") ?? value);
  const validation = get(value, "validation");
  const mapMessages = (input: unknown) =>
    list(input)
      .map((item) =>
        typeof item === "string"
          ? item
          : text(get(item, "message", "msg"), text(get(item, "code"))),
      )
      .filter(Boolean);
  return {
    plan: rawPlan as unknown as ImagePlan,
    validation: {
      errors: mapMessages(get(validation, "errors")),
      warnings: mapMessages(get(validation, "warnings")),
    },
  };
}

function mapDeliverySummary(value: unknown, filters?: GalleryFilters) {
  const raw = asObject(value);
  const metricName = (filters?.metric ?? "reach") as MetricName;
  const window = filters?.window ?? "48h";
  const snapshots = asObject(
    get(
      raw,
      window === "48h" ? "metrics_48h" : "metrics_7d",
      window === "48h" ? "metrics48h" : "metrics7d",
    ),
  );
  const metrics = asObject(get(snapshots, "metrics") ?? snapshots);
  const valueForMetric = get(metrics, metricName);
  return {
    deliveryId: text(get(raw, "delivery_id", "deliveryId")),
    platform: castPlatform(get(raw, "platform")),
    accountAlias: text(get(raw, "account_alias", "accountAlias")),
    placement: castPlacement(get(raw, "placement")),
    status: castDeliveryStatus(get(raw, "status")),
    publishedAt: nullableText(get(raw, "published_at", "publishedAt")),
    permalink: nullableText(get(raw, "permalink") ?? get(get(raw, "remote"), "permalink")),
    metricValue: number(valueForMetric),
    metricName: valueForMetric === null || valueForMetric === undefined ? null : metricName,
    window: valueForMetric === null || valueForMetric === undefined ? null : window,
    commentStatus: get(raw, "comment_status", "commentStatus") as
      | ImageDelivery["commentStatus"]
      | undefined,
  };
}

function mapPublicationDelivery(
  value: unknown,
  filters?: GalleryFilters,
): PublicationDeliveryDetail {
  const delivery = mapDeliverySummary(value, filters);
  return {
    ...delivery,
    scheduledAt: nullableText(get(value, "scheduled_at", "scheduledAt")),
    timezone: nullableText(get(value, "timezone")),
    lastError: nullableText(get(value, "last_error", "lastError")),
    remote: mapRemote(get(value, "remote")),
    targetId: nullableText(get(value, "target_id", "targetId")),
    removedAt: nullableText(get(value, "removed_at", "removedAt")),
    removalReason: nullableText(get(value, "removal_reason", "removalReason")),
    removalInstruction: nullableText(get(value, "removal_instruction", "removalInstruction")),
    removalGraphResponse: Object.keys(
      asObject(get(value, "removal_graph_response", "removalGraphResponse")),
    ).length
      ? asObject(get(value, "removal_graph_response", "removalGraphResponse"))
      : null,
  };
}

function mapPublicationSummary(value: unknown, filters?: GalleryFilters): PublicationSummary {
  const editorial = get(value, "editorial");
  const technical = get(value, "technical");
  const kind = get(value, "kind") ?? get(technical, "kind");
  const slideSource = list(get(value, "slides") ?? get(technical, "slides"));
  const slides = slideSource.map((item, index) => ({
    slideId: text(get(item, "slide_id", "slideId"), `slide-${index + 1}`),
    assetId: text(get(item, "asset_id", "assetId")),
    order: number(get(item, "order", "slide_order", "slideOrder")) ?? index + 1,
    previewUrl: nullableText(get(item, "preview_url", "previewUrl")),
    altTextFacebook: text(get(item, "alt_text_fb", "altTextFacebook")),
    altTextInstagram: text(get(item, "alt_text_ig", "altTextInstagram")),
  }));
  const deliveryRows = list(get(value, "deliveries", "delivery_summaries", "deliverySummaries"));
  const deliveries = deliveryRows.map((item) => mapDeliverySummary(item, filters));
  const baseKind =
    kind === "carousel" || kind === "story" || kind === "reel"
      ? (kind as PublicationSummary["kind"])
      : "image";
  return {
    publicationId: text(get(value, "publication_id", "publicationId")),
    categoryId: text(
      get(value, "category_id", "categoryId"),
      text(get(editorial, "category_id", "categoryId")),
    ),
    categoryName: text(
      get(value, "category_name", "categoryName"),
      text(get(editorial, "category_id", "categoryId")),
    ),
    topic: text(get(value, "topic"), text(get(editorial, "topic"))),
    title: text(get(value, "title"), text(get(editorial, "title"))),
    kind: publicationFormat(baseKind, deliveries),
    templateId: text(
      get(value, "template_id", "templateId"),
      text(get(technical, "template_id", "templateId")),
    ),
    strategyId: nullableText(
      get(value, "strategy_id", "strategyId") ?? get(editorial, "strategy_id", "strategyId"),
    ),
    status:
      get(value, "status") === "removed_api" || get(value, "status") === "removed_manually"
        ? (get(value, "status") as PublicationSummary["status"])
        : castPostStatus(get(value, "status")),
    createdAt: text(get(value, "created_at", "createdAt")),
    latestPublishedAt: nullableText(get(value, "latest_published_at", "latestPublishedAt")),
    coverAssetId:
      nullableText(get(value, "cover_asset_id", "coverAssetId")) ?? slides[0]?.assetId ?? null,
    coverUrl: nullableText(get(value, "cover_url", "coverUrl", "preview_url", "previewUrl")),
    slides,
    deliveries,
    isDemo: get(value, "is_demo", "isDemo") === true,
  };
}

function mapSnapshot(value: unknown): MetricSnapshot {
  const rawMetrics = get(value, "metrics");
  const metrics =
    rawMetrics && typeof rawMetrics === "object" ? (rawMetrics as MetricSnapshot["metrics"]) : null;
  return {
    snapshotId: text(get(value, "snapshot_id", "snapshotId")),
    deliveryId: text(get(value, "delivery_id", "deliveryId")),
    window: get(value, "window") === "7d" ? "7d" : "48h",
    observedAt: text(get(value, "observed_at", "observedAt")),
    metrics,
    status: text(get(value, "status"), "unknown"),
  };
}

function mapPublicationDetail(value: unknown, filters?: GalleryFilters): PublicationDetail {
  const raw = asObject(get(value, "record") ?? value);
  const editorial = get(raw, "editorial");
  const technical = asObject(get(raw, "technical"));
  const summary = mapPublicationSummary(raw, filters);
  const technicalSlides = list(get(technical, "slides"));
  const summarySlides =
    summary.slides.length > 0
      ? summary.slides
      : technicalSlides.map((slide, index) => ({
          slideId: text(get(slide, "slide_id", "slideId"), `slide-${index + 1}`),
          assetId: text(get(slide, "asset_id", "assetId")),
          order: number(get(slide, "order", "slide_order", "slideOrder")) ?? index + 1,
          previewUrl: nullableText(get(slide, "preview_url", "previewUrl")),
          altTextFacebook: "",
          altTextInstagram: "",
        }));
  const editorialSlides = list(get(editorial, "slides"));
  const slidesWithAlt = summarySlides.map((slide) => {
    const editorialSlide = editorialSlides.find(
      (candidate) =>
        get(candidate, "slide_id", "slideId") === slide.slideId ||
        number(get(candidate, "order")) === slide.order,
    );
    return {
      ...slide,
      altTextFacebook: text(
        get(editorialSlide, "alt_text_fb", "altTextFacebook"),
        slide.altTextFacebook,
      ),
      altTextInstagram: text(
        get(editorialSlide, "alt_text_ig", "altTextInstagram"),
        slide.altTextInstagram,
      ),
    };
  });
  const sourceRows = list(get(editorial, "sources"));
  const validationRows = list(get(technical, "validations"));
  const usageRows = list(get(technical, "ai_usage", "aiUsage"));
  const deliveryRows = list(get(raw, "deliveries"));
  return {
    ...summary,
    slides: slidesWithAlt,
    deliveries: deliveryRows.length
      ? deliveryRows.map((delivery) => mapPublicationDelivery(delivery, filters))
      : summary.deliveries.map((delivery) => ({
          ...delivery,
          scheduledAt: null,
          timezone: null,
          lastError: null,
          remote: {
            photoIds: [],
            childContainerIds: [],
            parentContainerId: null,
            postId: null,
            permalink: delivery.permalink,
            commentId: null,
          },
          targetId: null,
          removedAt: null,
          removalReason: null,
          removalInstruction: null,
          removalGraphResponse: null,
        })),
    sourceVideoId: nullableText(get(editorial, "source_video_id", "sourceVideoId")),
    sourceVideoUrl: nullableText(get(editorial, "source_video_url", "sourceVideoUrl")),
    sources: sourceRows.map((source) => ({
      title: text(get(source, "title")),
      url: text(get(source, "url")),
      locator: text(get(source, "locator")),
    })),
    copy: mapCopy(get(editorial, "copy")),
    technical: {
      renderSeconds: number(
        get(technical, "render_seconds", "renderSeconds") ??
          get(get(technical, "render"), "duration_seconds", "durationSeconds"),
      ),
      rendererVersion: nullableText(
        get(technical, "renderer_version", "rendererVersion") ??
          get(get(technical, "composition_plan"), "renderer_version", "rendererVersion"),
      ),
      planHash: nullableText(
        get(technical, "plan_hash", "planHash") ??
          get(get(technical, "composition_plan"), "plan_hash", "planHash"),
      ),
      styleId: nullableText(
        get(technical, "style_id", "styleId") ??
          get(get(technical, "composition_plan"), "style_id", "styleId"),
      ),
      styleVersion: nullableText(
        get(technical, "style_version", "styleVersion") ??
          get(get(technical, "composition_plan"), "style_version", "styleVersion"),
      ),
      validations: validationRows.map((item) => ({
        name: text(get(item, "name")),
        passed: get(item, "passed") === true,
        details: asObject(get(item, "details")),
      })),
      slides: technicalSlides.map((slide, index) => ({
        assetId: text(get(slide, "asset_id", "assetId")),
        slideId: text(get(slide, "slide_id", "slideId"), `slide-${index + 1}`),
        order: number(get(slide, "order", "slide_order", "slideOrder")) ?? index + 1,
        mime: text(get(slide, "mime"), "image/jpeg"),
        width: number(get(slide, "width")),
        height: number(get(slide, "height")),
        aspectRatio: nullableText(get(slide, "aspect_ratio", "aspectRatio")),
        bytes: number(get(slide, "bytes")),
        colorProfile: nullableText(get(slide, "color_profile", "colorProfile")),
        sha256: nullableText(get(slide, "sha256")),
        previewUrl: nullableText(get(slide, "preview_url", "previewUrl")),
      })),
      music: mapMusic(get(technical, "music")),
      aiUsage: usageRows.map((usage) => ({
        provider: text(get(usage, "provider")),
        model: text(get(usage, "model")),
        role: text(get(usage, "role")),
        inputTokens: number(get(usage, "input_tokens", "inputTokens")),
        outputTokens: number(get(usage, "output_tokens", "outputTokens")),
        reasoningTokens: number(get(usage, "reasoning_tokens", "reasoningTokens")),
        cachedInputTokens: number(get(usage, "cached_input_tokens", "cachedInputTokens")),
        totalTokens: number(get(usage, "total_tokens", "totalTokens")),
        seconds: number(get(usage, "seconds")),
      })),
      copySources: Object.fromEntries(
        Object.entries(asObject(get(technical, "copy_sources", "copySources"))).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
      reel: get(technical, "reel")
        ? {
            assetId: text(get(get(technical, "reel"), "asset_id", "assetId")),
            previewUrl: nullableText(get(get(technical, "reel"), "preview_url", "previewUrl")),
            bytes: number(get(get(technical, "reel"), "bytes")),
            sha256: nullableText(get(get(technical, "reel"), "sha256")),
            durationSec: number(get(get(technical, "reel"), "duration_seconds", "durationSec")),
            codec: nullableText(get(get(technical, "reel"), "codec")),
            audioCodec: nullableText(get(get(technical, "reel"), "audio_codec", "audioCodec")),
            fps: number(get(get(technical, "reel"), "fps")),
          }
        : null,
    },
    metricsSnapshots: list(get(raw, "metrics_snapshots", "metricsSnapshots")).map(mapSnapshot),
    reviewRequired: get(get(editorial, "review"), "required") !== false,
    isDemo: get(raw, "is_demo", "isDemo") === true,
  };
}

export async function getImageStyles(
  categoryId: string,
  signal?: AbortSignal,
): Promise<StyleOption[]> {
  const payload = await fetchImageStyles(categoryId, signal);
  return list(get(payload, "styles")).map((style) => mapStyle(style, categoryId));
}

export async function getImageStrategies(signal?: AbortSignal): Promise<ImageStrategy[]> {
  const payload = await fetchImageStrategies(signal);
  return list(payload).flatMap((item) => {
    const id = text(get(item, "id"));
    const templateId = get(item, "template_id", "templateId");
    if (!id || (templateId !== "daily_fact" && templateId !== "five_slides")) return [];
    return [
      {
        id,
        name: text(get(item, "name"), id),
        description: text(get(item, "description")),
        goal: text(get(item, "goal")),
        templateId,
        factsNeeded: number(get(item, "facts_needed", "factsNeeded")) ?? 1,
      },
    ];
  });
}

export async function getImageCapabilities(
  categoryId: string,
  signal?: AbortSignal,
): Promise<Capabilities> {
  const payload = await fetchImageCapabilities(categoryId, signal);
  return {
    accounts: list(get(payload, "accounts")).map(mapAccount),
    reviewRequired: get(payload, "review_required", "reviewRequired") !== false,
  };
}

export async function getImagePosts(
  categoryId: string,
  signal?: AbortSignal,
): Promise<ImagePost[]> {
  const payload = await fetchImagePosts(categoryId, signal);
  return list(get(payload, "items") ?? payload).map(mapImagePost);
}

export async function getImagePost(postId: string, signal?: AbortSignal): Promise<ImagePost> {
  return mapImagePost(await fetchImagePost(postId, signal));
}

export async function createPlan(input: {
  category_id: string;
  source_video_id: string;
  template_id: "daily_fact" | "five_slides";
  style_id: string;
  strategy_id?: string;
}) {
  return mapPlanResponse(await createImagePlan(input));
}

export async function renderPlan(planId: string) {
  const payload = await renderImagePlan(planId);
  return {
    postId: text(get(payload, "post_id", "postId")),
    status: castPostStatus(get(payload, "status")),
  };
}

export async function saveImagePost(postId: string, patch: ImagePostPatch): Promise<ImagePost> {
  return mapImagePost(await patchImagePost(postId, patch));
}

export async function reviewImagePost(
  postId: string,
  revision: number,
  decision: "approve" | "reject",
  note?: string,
): Promise<ImagePost> {
  return mapImagePost(
    await requestImagePostReview(postId, { revision, decision, ...(note ? { note } : {}) }),
  );
}

export async function scheduleImagePost(
  postId: string,
  revision: number,
  targets: Array<{
    platform: Platform;
    account_alias: string;
    placement: Placement;
    scheduled_at?: string;
  }>,
) {
  const payload = await createImageDeliveries(postId, {
    revision,
    targets,
  });
  return list(get(payload, "deliveries")).map(mapDelivery);
}

export async function publishImageNow(deliveryId: string): Promise<ImageDelivery> {
  return mapDelivery(await publishImageDelivery(deliveryId));
}

export async function cancelImagePostDelivery(deliveryId: string): Promise<ImageDelivery> {
  return mapDelivery(await cancelImageDelivery(deliveryId));
}

export async function reconcileImagePostDelivery(
  deliveryId: string,
  remotePostId?: string,
): Promise<ImageDelivery> {
  return mapDelivery(await reconcileImageDelivery(deliveryId, remotePostId));
}

export async function getImagePostDelivery(
  deliveryId: string,
  signal?: AbortSignal,
): Promise<ImageDelivery> {
  return mapDelivery(await fetchImageDelivery(deliveryId, signal));
}

async function resolveGalleryAsset(
  publicationId: string,
  assetId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const payload = await fetchPublicationAssetUrl(publicationId, assetId, signal);
    return nullableText(get(payload, "url", "preview_url", "previewUrl"));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && process.env.NODE_ENV === "development")
      return null;
    throw error;
  }
}

export async function getPublications(
  filters: GalleryFilters,
  signal?: AbortSignal,
  cursor?: string | null,
): Promise<{ items: PublicationSummary[]; nextCursor: string | null; asOf: string }> {
  const payload = await fetchPublications(filters, signal, cursor);
  const initialItems = list(get(payload, "items")).map((item) =>
    mapPublicationSummary(item, filters),
  );
  const result = {
    items: initialItems,
    nextCursor: nullableText(get(payload, "next_cursor", "nextCursor")),
    asOf: text(get(payload, "as_of", "asOf")),
  };
  if (result.items.some((item) => item.isDemo)) return result;

  const items = await Promise.all(
    result.items.map(async (item) => {
      if (item.coverUrl) return item;
      const assetId = item.coverAssetId ?? item.slides[0]?.assetId;
      if (!assetId) return item;
      const coverUrl = await resolveGalleryAsset(item.publicationId, assetId, signal);
      return {
        ...item,
        coverAssetId: assetId,
        coverUrl,
        slides: item.slides.map((slide) =>
          slide.assetId === assetId ? { ...slide, previewUrl: coverUrl } : slide,
        ),
      };
    }),
  );
  return { ...result, items };
}

export async function getPublicationDetail(
  publicationId: string,
  signal?: AbortSignal,
): Promise<PublicationDetail> {
  const raw = await fetchPublication(publicationId, signal);
  if (get(raw, "is_demo", "isDemo") === true) return mapPublicationDetail(raw);
  const detail = mapPublicationDetail(raw);
  const sourceSlides =
    detail.slides.length > 0
      ? detail.slides
      : detail.technical.slides.map((slide) => ({
          slideId: slide.slideId,
          assetId: slide.assetId,
          order: slide.order,
          previewUrl: slide.previewUrl,
          altTextFacebook: "",
          altTextInstagram: "",
        }));
  const slidesWithUrls = await Promise.all(
    sourceSlides.map(async (slide) => ({
      ...slide,
      previewUrl:
        slide.previewUrl ?? (await resolveGalleryAsset(publicationId, slide.assetId, signal)),
    })),
  );
  let reel = detail.technical.reel;
  if (reel && !reel.previewUrl && reel.assetId) {
    reel = { ...reel, previewUrl: await resolveGalleryAsset(publicationId, reel.assetId, signal) };
  }
  return { ...detail, slides: slidesWithUrls, technical: { ...detail.technical, reel } };
}

export async function removePublishedPublication(
  publicationId: string,
  reason: string,
  retryApi = false,
) {
  return mapPublicationDetail(await removePublication(publicationId, reason, retryApi));
}

export async function refreshPublicationMetrics(
  publicationId: string,
  deliveryId: string,
  window: MetricsWindow,
  signal?: AbortSignal,
): Promise<MetricSnapshot[]> {
  const payload = await fetchPublicationMetrics(publicationId, deliveryId, window, signal);
  return list(get(payload, "items") ?? payload).map(mapSnapshot);
}

export function isEditorError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function imagePostPreviewUrl(postId: string, assetId: string): string {
  return imagePostAssetUrl(postId, assetId);
}
