import { httpClient } from "@/infrastructure/api/http-client";
import type { RenderStudioDetail } from "@/infrastructure/api/types";

export function getRenderStudio(jobId: string): Promise<RenderStudioDetail> {
  return httpClient(`/api/v1/renders/${jobId}`);
}
