import { ApiError } from "@/infrastructure/api/api-error";
import { httpClient } from "@/infrastructure/api/http-client";
import type { CreateVideoFormValues } from "../schema";
import type { JobHandle, JobStage } from "../types";

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

interface BatchAcceptedResponseDto {
  total: number;
  jobs: { job_id: string; category: string; stage: JobStage }[];
  status_url_template: string;
}

function mapJobHandle(dto: BatchAcceptedResponseDto["jobs"][number]): JobHandle {
  return { jobId: dto.job_id, category: dto.category, stage: dto.stage };
}

function buildCreateVideoFormData(values: CreateVideoFormValues): FormData {
  const formData = new FormData();
  formData.append("category_name", values.categoryName);
  formData.append("quantity", String(values.quantity));
  if (values.userContext) formData.append("user_context", values.userContext);
  formData.append("duration_mode", values.durationMode);
  if (values.durationMode === "auto") {
    formData.append("repeat_count", String(values.repeatCount));
  } else if (values.manualSeconds !== undefined) {
    formData.append("manual_seconds", String(values.manualSeconds));
  }
  if (values.songName) formData.append("song_name", values.songName);
  if (values.artist) formData.append("artist", values.artist);
  if (values.topic) formData.append("topic", values.topic);
  if (values.songDescription) formData.append("song_description", values.songDescription);
  if (values.language) formData.append("language", values.language);
  if (values.imageFile) formData.append("image_file", values.imageFile);
  if (values.musicFile) formData.append("music_file", values.musicFile);
  if (values.videoFile) formData.append("video_file", values.videoFile);
  if (values.imageAssetId) formData.append("image_asset_id", values.imageAssetId);
  if (values.musicAssetId) formData.append("music_asset_id", values.musicAssetId);
  if (values.videoAssetId) formData.append("video_asset_id", values.videoAssetId);
  if (values.renderTarget) formData.append("render_target", values.renderTarget);
  if (values.recorderEngineOverride) {
    formData.append("recorder_engine_override", values.recorderEngineOverride);
  }
  for (const account of values.publishingAccounts) {
    formData.append("publishing_accounts", account);
  }
  return formData;
}

/** Fire-and-forget: el backend responde casi al instante con los job_id — no
 * espera a que el pipeline termine. Ver `useJobStatus` para el polling. */
export async function createVideoJob(
  values: CreateVideoFormValues,
  signal?: AbortSignal,
): Promise<JobHandle[]> {
  const formData = buildCreateVideoFormData(values);
  try {
    const dto = await httpClient<BatchAcceptedResponseDto>("/api/v1/videos/upload", {
      method: "POST",
      body: formData,
      signal,
    });
    return dto.jobs.map(mapJobHandle);
  } catch (error) {
    if (error instanceof ApiError && error.fieldErrors.length > 0) {
      throw new ApiError(
        error.status,
        error.message,
        error.fieldErrors.map((fe) => ({ ...fe, path: snakeToCamel(fe.path) })),
      );
    }
    throw error;
  }
}
