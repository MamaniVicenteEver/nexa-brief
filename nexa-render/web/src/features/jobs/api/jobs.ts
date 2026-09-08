import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";
import type { RenderJob, SubmitJobPayload } from "@/infrastructure/api/types";

export function submitJob(
  payload: SubmitJobPayload,
): Promise<{ jobId: string; engineUsed: string }> {
  return httpClient("/api/v1/jobs", { method: "POST", body: payload });
}

export function getJobStatus(jobId: string): Promise<RenderJob> {
  return httpClient(`/api/v1/jobs/${jobId}`);
}

export function fileUrl(jobId: string, filename: string): string {
  return resolveApiUrl(`/files/${jobId}/${filename}`);
}
