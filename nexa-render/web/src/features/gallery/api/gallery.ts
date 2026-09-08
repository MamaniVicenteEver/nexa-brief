import { httpClient } from "@/infrastructure/api/http-client";
import type { EngineName, GalleryResponse, VideoFormat } from "@/infrastructure/api/types";

export function getGallery(query: {
  page?: number;
  pageSize?: number;
  engine?: EngineName;
  format?: VideoFormat;
} = {}): Promise<GalleryResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.engine) params.set("engine", query.engine);
  if (query.format) params.set("format", query.format);
  return httpClient(`/api/v1/gallery?${params.toString()}`);
}
