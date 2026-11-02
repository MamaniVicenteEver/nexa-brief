import type { ImagePostFormat } from "../image-formats";
import { requestJson } from "./client";

export interface ImageCodePreview {
  html: string;
  format: ImagePostFormat;
  width: number;
  height: number;
  revision: number;
  plan_hash: string;
  slide_id: string;
}

export function fetchImageCodePreview(
  postId: string,
  slideId: string,
  format: ImagePostFormat,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ format, slide_id: slideId });
  return requestJson<ImageCodePreview>(
    `/api/image-posts/${encodeURIComponent(postId)}/preview?${query}`,
    { signal },
  );
}
