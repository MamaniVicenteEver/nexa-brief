import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";

/** Una petición de render aislado; la API admite lotes para futuras cuadrículas. */
export interface ComponentPreviewRequest {
  key: string;
  videoId: string;
  component: string;
  params: Record<string, unknown>;
  timeSeconds?: number;
  durationSeconds?: number;
}

export interface ComponentPreviewResult {
  key: string;
  videoId: string;
  design: string;
  component: string;
  previewUrl: string;
}

interface ComponentPreviewBatchDto {
  previews: {
    key: string;
    video_id: string;
    design: string;
    component: string;
    preview_url: string;
  }[];
}

/** Pide URLs para uno o varios componentes de video en una sola llamada. */
export async function requestComponentPreviews(
  previews: ComponentPreviewRequest[],
  signal?: AbortSignal,
): Promise<ComponentPreviewResult[]> {
  const dto = await httpClient<ComponentPreviewBatchDto>("/api/explainer/component-previews", {
    method: "POST",
    timeoutMs: 15_000,
    signal,
    sameOrigin: true,
    body: {
      previews: previews.map((item) => ({
        key: item.key,
        video_id: item.videoId,
        component: item.component,
        params: item.params,
        time_seconds: item.timeSeconds ?? 3,
        duration_seconds: item.durationSeconds ?? 6,
      })),
    },
  });
  return dto.previews.map((item) => ({
    key: item.key,
    videoId: item.video_id,
    design: item.design,
    component: item.component,
    previewUrl: resolveApiUrl(item.preview_url),
  }));
}
