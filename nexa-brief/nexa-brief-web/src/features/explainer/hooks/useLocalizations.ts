"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { httpClient } from "@/infrastructure/api/http-client";
import type {
  ExplainerJobDto,
  PublishPackageReviewDto,
  ThumbnailsDto,
} from "../api/explainer-service";
import type { PublishIssue } from "../types";

export type LocalizationStatus =
  | "ready"
  | "needs_review"
  | "missing"
  | "queued"
  | "generating"
  | "failed";
export interface Localization {
  locale: string;
  label: string;
  name: string;
  status: LocalizationStatus;
  is_original: boolean;
  preview_url: string | null;
  job_id: string | null;
  revision?: string | null;
  job_status?: string | null;
  resumable?: boolean;
  stale?: boolean;
  progress?: { stage: string; percent: number } | null;
  error?: string | null;
  title?: string | null;
  publish?: Record<string, unknown> | null;
  studio?: {
    issues: PublishIssue[];
    approval_token?: string;
    publish_package?: PublishPackageReviewDto | null;
    thumbnails?: ThumbnailsDto;
    ready?: boolean;
    publish_ready?: boolean;
    last_job?: ExplainerJobDto | null;
    title_max_chars: number;
    opening: {
      text: string;
      image_url: string | null;
      preview_url: string;
      component: string;
    } | null;
    duration_seconds: number | null;
    capabilities: { record: boolean; publish: boolean };
  } | null;
}
interface Localizations {
  video_id: string;
  supported: boolean;
  default_locale: string;
  locales: Localization[];
}
export interface LocalizationJob {
  job_id: string;
  video_id: string;
  locale: string;
  status: "queued" | "running" | "generating" | "completed" | "ready" | "needs_review" | "failed";
  stage: string;
  percent: number;
  error: string | null;
}
export const activeLocalization = (status: string) =>
  status === "queued" || status === "generating" || status === "running";

export function useLocalizations(videoId: string, open: boolean) {
  const client = useQueryClient();
  const key = ["explainer-localizations", videoId];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      httpClient<Localizations>(
        `/api/v1/explainer/videos/${encodeURIComponent(videoId)}/localizations`,
        { signal },
      ),
    enabled: open,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  const jobs = useQueries({
    queries: (open ? (query.data?.locales ?? []) : [])
      .filter((item) => item.job_id && activeLocalization(item.job_status ?? item.status))
      .map((item) => ({
        queryKey: ["explainer-localization-job", videoId, item.locale, item.job_id],
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          httpClient<LocalizationJob>(
            `/api/v1/explainer/localization-jobs/${encodeURIComponent(item.job_id ?? "")}`,
            { signal },
          ),
        refetchInterval: (q: { state: { data?: LocalizationJob } }) =>
          !q.state.data || activeLocalization(q.state.data.status) ? 5000 : false,
        refetchOnWindowFocus: false,
        retry: false,
      })),
  });
  const terminalJobs = jobs
    .map((job) => job.data)
    .filter((job): job is LocalizationJob => Boolean(job && !activeLocalization(job.status)));
  const terminalKey = terminalJobs
    .map((job) => `${job.job_id}:${job.status}`)
    .sort()
    .join(",");
  const refreshed = useRef(new Set<string>());
  useEffect(() => {
    if (open && terminalKey && !refreshed.current.has(`${videoId}:${terminalKey}`)) {
      refreshed.current.add(`${videoId}:${terminalKey}`);
      void client.invalidateQueries({ queryKey: ["explainer-localizations", videoId] });
      void client.invalidateQueries({ queryKey: ["explainer-localization-preflight", videoId] });
    }
  }, [client, terminalKey, open, videoId]);
  const acceptJob = (job: { job_id: string; locale: string; status: LocalizationStatus }) => {
    // A resumed attempt can finish with the same job id and status as before.
    refreshed.current.clear();
    client.setQueryData<LocalizationJob>(
      ["explainer-localization-job", videoId, job.locale, job.job_id],
      {
        job_id: job.job_id,
        video_id: videoId,
        locale: job.locale,
        status: job.status === "missing" ? "queued" : (job.status as LocalizationJob["status"]),
        stage: "En cola",
        percent: 0,
        error: null,
      },
    );
    client.setQueryData<Localizations>(
      key,
      (data) =>
        data && {
          ...data,
          locales: data.locales.map((item) =>
            item.locale === job.locale
              ? {
                  ...item,
                  status: item.preview_url ? item.status : job.status,
                  job_status: job.status,
                  job_id: job.job_id,
                  error: null,
                  progress: { stage: "En cola", percent: 0 },
                }
              : item,
          ),
        },
    );
  };
  const create = useMutation({
    mutationFn: (locale: string) =>
      httpClient<{ job_id: string; locale: string; status: LocalizationStatus }>(
        `/api/v1/explainer/videos/${encodeURIComponent(videoId)}/localizations`,
        { method: "POST", body: { locale } },
      ),
    onSuccess: acceptJob,
    onError: () => {
      void client.invalidateQueries({ queryKey: key });
      void client.invalidateQueries({ queryKey: ["explainer-localization-preflight", videoId] });
    },
  });
  const resume = useMutation({
    mutationFn: (jobId: string) =>
      httpClient<{ job_id: string; locale: string; status: LocalizationStatus }>(
        `/api/v1/explainer/localization-jobs/${encodeURIComponent(jobId)}/resume`,
        { method: "POST" },
      ),
    onSuccess: (job) => {
      acceptJob(job);
      void client.invalidateQueries({
        queryKey: ["explainer-localization-job", videoId, job.locale, job.job_id],
      });
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: key });
      void client.invalidateQueries({ queryKey: ["explainer-localization-preflight", videoId] });
    },
  });
  return {
    ...query,
    jobs: jobs.map((job) => job.data).filter((job): job is LocalizationJob => Boolean(job)),
    create,
    resume,
    track: acceptJob,
  };
}

/** Acknowledge only the exact native artifacts reviewed in the player. */
export function useApproveLocalization(videoId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { locale: string; revision: string; artifactSha256: string }) =>
      httpClient(
        `/api/v1/explainer/videos/${encodeURIComponent(videoId)}/localizations/${encodeURIComponent(input.locale)}/approve`,
        {
          method: "POST",
          body: { revision: input.revision, artifact_sha256: input.artifactSha256 },
        },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["explainer-localizations", videoId] }),
  });
}

export interface LocalizationPreflight {
  ready: boolean;
  issues: PublishIssue[];
  next_action: "create" | "resume" | "wait" | "review" | "ready";
  job_id?: string | null;
  revision?: string | null;
}

/** Removing this query on close or language change aborts the in-flight request. */
export function useLocalizationPreflight(
  videoId: string,
  locale: string | undefined,
  enabled: boolean,
) {
  const results = useQueries({
    queries: (enabled && locale ? [locale] : []).map((selectedLocale) => ({
      queryKey: ["explainer-localization-preflight", videoId, selectedLocale],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        httpClient<LocalizationPreflight>(
          `/api/v1/explainer/videos/${encodeURIComponent(videoId)}/localizations/${encodeURIComponent(selectedLocale)}/preflight`,
          { signal },
        ),
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: false,
    })),
  });
  return results[0];
}
