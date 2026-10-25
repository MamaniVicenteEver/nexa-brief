import type {
  CreatePlanInput,
  DeliveryTargetInput,
  GalleryFilters,
  ImagePostPatch,
  ImageTemplateId,
  MusicOption,
} from "../types";
import { withActionIdempotency } from "./action-idempotency";
import { randomRequestId, requestJson } from "./client";

function serializeMusic(music: MusicOption) {
  if (music.mode === "none") return { mode: "none" as const };
  return {
    mode: music.mode,
    music_asset_id: music.musicAssetId,
    source_sha256: music.sourceSha256,
    license: music.license
      ? {
          spdx_or_name: music.license.spdxOrName,
          url: music.license.url,
          author: music.license.author,
          track_url: music.license.trackUrl,
          attribution: music.license.attribution,
          proof_ref: music.license.proofRef,
        }
      : undefined,
    trim_start_sec: music.trimStartSec,
    duration_sec: music.durationSec,
    gain_db: music.gainDb,
    selection: music.selection,
  };
}

export function fetchImageStyles(categoryId: string, signal?: AbortSignal) {
  return requestJson<unknown>(
    `/api/v1/image-posts/styles?category_id=${encodeURIComponent(categoryId)}`,
    { signal },
  );
}

export function fetchImageStrategies(signal?: AbortSignal) {
  return requestJson<unknown>("/api/v1/image-posts/strategies", { signal });
}

export interface LicensedMusicTrack {
  music_asset_id: string;
  title: string;
  author: string;
  source_sha256: string;
  license: {
    spdx_or_name: string;
    url: string;
    author: string;
    track_url: string;
    attribution: string;
    proof_ref: string;
  };
}

export function fetchLicensedMusic(signal?: AbortSignal) {
  return requestJson<{ tracks: LicensedMusicTrack[] }>("/api/v1/image-posts/music", { signal });
}

export function fetchImageCapabilities(categoryId: string, signal?: AbortSignal) {
  return requestJson<unknown>(
    `/api/v1/image-posts/capabilities?category_id=${encodeURIComponent(categoryId)}`,
    { signal },
  );
}

export function fetchImagePosts(categoryId: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ category_id: categoryId, limit: "50" });
  return requestJson<unknown>(`/api/v1/image-posts?${query.toString()}`, { signal });
}

export function fetchImagePost(postId: string, signal?: AbortSignal) {
  return requestJson<unknown>(`/api/v1/image-posts/${encodeURIComponent(postId)}`, { signal });
}

export function createImagePlan(input: CreatePlanInput) {
  return withActionIdempotency("create-plan", input, (key) =>
    requestJson<unknown>("/api/v1/image-posts/plans", {
      method: "POST",
      body: input,
      idempotencyKey: key,
    }),
  );
}

export function renderImagePlan(planId: string) {
  return requestJson<unknown>(`/api/v1/image-posts/plans/${encodeURIComponent(planId)}/render`, {
    method: "POST",
    body: {},
    idempotencyKey: randomRequestId(),
  });
}

export function patchImagePost(postId: string, patch: ImagePostPatch) {
  return requestJson<unknown>(`/api/v1/image-posts/${encodeURIComponent(postId)}`, {
    method: "PATCH",
    body: {
      revision: patch.revision,
      title: patch.title,
      copy: {
        facebook: {
          caption: patch.copy.facebook.caption,
          first_comment: patch.copy.facebook.firstComment,
        },
        instagram: {
          caption: patch.copy.instagram.caption,
          first_comment: patch.copy.instagram.firstComment,
        },
        hashtags: patch.copy.hashtags,
      },
      slides: patch.slides,
      music: serializeMusic(patch.music),
      review_required: patch.review_required,
    },
  });
}

export function reviewImagePost(
  postId: string,
  input: { revision: number; decision: "approve" | "reject"; note?: string },
) {
  return withActionIdempotency("review", { postId, input }, (key) =>
    requestJson<unknown>(`/api/v1/image-posts/${encodeURIComponent(postId)}/review`, {
      method: "POST",
      body: input,
      idempotencyKey: key,
    }),
  );
}

export function createImageDeliveries(
  postId: string,
  input: { revision: number; targets: DeliveryTargetInput[] },
) {
  return withActionIdempotency("deliveries", { postId, ...input }, (key) =>
    requestJson<unknown>(`/api/v1/image-posts/${encodeURIComponent(postId)}/deliveries`, {
      method: "POST",
      body: { ...input, client_request_id: key },
      idempotencyKey: key,
    }),
  );
}

export function publishImageDelivery(deliveryId: string) {
  return withActionIdempotency("publish-now", { deliveryId }, (key) =>
    requestJson<unknown>(
      `/api/v1/image-posts/deliveries/${encodeURIComponent(deliveryId)}/publish-now`,
      {
        method: "POST",
        body: {},
        idempotencyKey: key,
      },
    ),
  );
}

export function cancelImageDelivery(deliveryId: string) {
  return requestJson<unknown>(
    `/api/v1/image-posts/deliveries/${encodeURIComponent(deliveryId)}/cancel`,
    {
      method: "POST",
      body: {},
      idempotencyKey: randomRequestId(),
    },
  );
}

export function reconcileImageDelivery(deliveryId: string, remotePostId?: string) {
  return requestJson<unknown>(
    `/api/v1/image-posts/deliveries/${encodeURIComponent(deliveryId)}/reconcile`,
    { method: "POST", body: remotePostId ? { remote_post_id: remotePostId } : {} },
  );
}

export function fetchImageDelivery(deliveryId: string, signal?: AbortSignal) {
  return requestJson<unknown>(`/api/v1/image-posts/deliveries/${encodeURIComponent(deliveryId)}`, {
    signal,
  });
}

export function imagePostAssetUrl(postId: string, assetId: string): string {
  return `/api/v1/image-posts/${encodeURIComponent(postId)}/assets/${encodeURIComponent(assetId)}`;
}

export function templateCount(templateId: ImageTemplateId): number {
  return templateId === "five_slides" ? 5 : 1;
}

export function galleryQuery(filters: GalleryFilters, limit = 24, cursor?: string | null): string {
  const query = new URLSearchParams({
    metric: filters.metric,
    window: filters.window,
    sort: filters.sort,
    limit: String(limit),
  });
  if (filters.platform !== "all") query.set("platform", filters.platform);
  if (filters.kind === "reel") query.set("placement", "reel");
  else if (filters.kind !== "all") query.set("kind", filters.kind);
  if (filters.strategyId !== "all") query.set("strategy_id", filters.strategyId);
  if (filters.status !== "all") query.set("status", filters.status);
  if (filters.categoryId) query.set("category_id", filters.categoryId);
  if (cursor) query.set("cursor", cursor);
  return query.toString();
}
