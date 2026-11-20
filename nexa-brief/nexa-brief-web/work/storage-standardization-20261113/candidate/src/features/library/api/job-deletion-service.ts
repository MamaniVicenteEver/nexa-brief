import type { ChannelPlatform } from "@/features/channels";
import { httpClient } from "@/infrastructure/api/http-client";

/** Borrar en varias plataformas puede tardar (cada API remota por separado). */
const DELETE_TIMEOUT_MS = 120_000;

interface PublicationDto {
  platform: ChannelPlatform;
  account_alias: string;
  post_id: string;
  url: string | null;
  title: string | null;
  can_delete_remote: boolean;
}

export interface JobPublication {
  platform: ChannelPlatform;
  accountAlias: string;
  postId: string;
  url: string | null;
  canDeleteRemote: boolean;
}

export type PublicationDeletionStatus = "deleted" | "already_gone" | "unsupported" | "failed";

interface PublicationDeletionDto {
  platform: ChannelPlatform;
  account_alias: string;
  post_id: string;
  status: PublicationDeletionStatus;
  error: string | null;
}

export interface PublicationDeletion {
  platform: ChannelPlatform;
  accountAlias: string;
  postId: string;
  status: PublicationDeletionStatus;
  error: string | null;
}

interface JobDeletionDto {
  job_id: string;
  deleted_local: boolean;
  publications: PublicationDeletionDto[];
}

export interface JobDeletion {
  jobId: string;
  deletedLocal: boolean;
  publications: PublicationDeletion[];
}

export async function getJobPublications(
  jobId: string,
  signal?: AbortSignal,
): Promise<JobPublication[]> {
  const dtos = await httpClient<PublicationDto[]>(`/api/v1/videos/jobs/${jobId}/publications`, {
    signal,
  });
  return dtos.map((dto) => ({
    platform: dto.platform,
    accountAlias: dto.account_alias,
    postId: dto.post_id,
    url: dto.url,
    canDeleteRemote: dto.can_delete_remote,
  }));
}

export async function deleteJob(jobId: string, remote: boolean): Promise<JobDeletion> {
  const dto = await httpClient<JobDeletionDto>(
    `/api/v1/videos/jobs/${jobId}?remote=${remote ? "true" : "false"}`,
    { method: "DELETE", timeoutMs: DELETE_TIMEOUT_MS },
  );
  return {
    jobId: dto.job_id,
    deletedLocal: dto.deleted_local,
    publications: dto.publications.map((p) => ({
      platform: p.platform,
      accountAlias: p.account_alias,
      postId: p.post_id,
      status: p.status,
      error: p.error,
    })),
  };
}
