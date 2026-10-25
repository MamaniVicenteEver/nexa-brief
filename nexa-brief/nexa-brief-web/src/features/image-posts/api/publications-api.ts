import type { GalleryFilters } from "../types";
import { requestJson } from "./client";
import { galleryQuery } from "./image-posts-api";

export function fetchPublications(
  filters: GalleryFilters,
  signal?: AbortSignal,
  cursor?: string | null,
) {
  return requestJson<unknown>(`/api/v1/publications?${galleryQuery(filters, 24, cursor)}`, {
    signal,
  });
}

export function fetchPublication(publicationId: string, signal?: AbortSignal) {
  return requestJson<unknown>(`/api/v1/publications/${encodeURIComponent(publicationId)}`, {
    signal,
  });
}

export function fetchPublicationAssetUrl(
  publicationId: string,
  assetId: string,
  signal?: AbortSignal,
) {
  const path = `/api/v1/publications/${encodeURIComponent(publicationId)}/assets/${encodeURIComponent(assetId)}/url?purpose=preview`;
  return requestJson<unknown>(path, { signal });
}

export function fetchPublicationMetrics(
  publicationId: string,
  deliveryId: string,
  window: "48h" | "7d",
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ delivery_id: deliveryId, window });
  return requestJson<unknown>(
    `/api/v1/publications/${encodeURIComponent(publicationId)}/metrics?${query}`,
    { signal },
  );
}
