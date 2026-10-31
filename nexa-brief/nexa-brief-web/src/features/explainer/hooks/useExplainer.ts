import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { httpClient } from "@/infrastructure/api/http-client";
import {
  captureThumbnails,
  chooseThumbnail,
  createProduction,
  generateBrief,
  generatePublishTexts,
  getCategoryDesigns,
  getDesignGroups,
  getExplainerOptions,
  getExplainerJobs,
  getExplainerVideos,
  getProduction,
  getProductions,
  recordExplainerVideo,
  resumeProduction,
} from "../api/explainer-service";
import { useRecordingTrayStore } from "../store/recording-tray-store";
import {
  ACTIVE_JOB_STATES,
  ACTIVE_PRODUCTION_STATES,
  type BriefInput,
  type CreateProductionInput,
  type ExplainerJob,
  type ExplainerVideo,
  type Production,
  type RecordExplainerInput,
  type TextProvider,
  type ThumbnailOptionId,
} from "../types";

const POLL_MS = 5_000;
const RECORDING_POLL_MS = 3_000;
const VIDEOS_KEY = ["explainer-videos"] as const;
export { VIDEOS_KEY as EXPLAINER_VIDEOS_QUERY_KEY };
const PRODUCTIONS_KEY = ["explainer-productions"] as const;
export const RECORDING_JOBS_QUERY_KEY = ["explainer-recordings"] as const;

/** Sin `categoryPath` trae todos los videos; con él, solo los de esa categoría. */
export function useExplainerVideos(categoryPath?: string) {
  return useQuery({
    queryKey: [...VIDEOS_KEY, categoryPath ?? "all"],
    queryFn: ({ signal }) => getExplainerVideos(categoryPath, signal),
    // Mientras haya una grabación en curso, refresca para ver el progreso.
    refetchInterval: (query) => {
      const videos = (query.state.data ?? []) as ExplainerVideo[];
      const busy = videos.some((v) => v.lastJob && ACTIVE_JOB_STATES.includes(v.lastJob.state));
      return busy ? RECORDING_POLL_MS : false;
    },
    refetchOnWindowFocus: false,
  });
}

export function useRecordExplainerVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordExplainerInput) => recordExplainerVideo(input),
    onSuccess: (job, input) => {
      const cached = queryClient.getQueriesData<ExplainerVideo[]>({ queryKey: VIDEOS_KEY });
      const video = cached
        .flatMap(([, videos]) => videos ?? [])
        .find((item) => item.videoId === input.videoId);
      useRecordingTrayStore.getState().addRecording({
        jobId: job.jobId,
        videoId: job.videoId,
        title: video?.youtubeTitle || video?.title || input.videoId,
      });
      queryClient.invalidateQueries({ queryKey: VIDEOS_KEY });
      queryClient.invalidateQueries({ queryKey: RECORDING_JOBS_QUERY_KEY });
    },
  });
}

/** Sondea grabaciones mientras haya alguna activa y se detiene al terminar. */
export function useExplainerRecordings() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: RECORDING_JOBS_QUERY_KEY,
    queryFn: ({ signal }) => getExplainerJobs(signal),
    refetchInterval: (query) => {
      const jobs = query.state.data ?? [];
      return jobs.some((job) => ACTIVE_JOB_STATES.includes(job.state)) ? RECORDING_POLL_MS : false;
    },
    refetchOnWindowFocus: false,
  });
  const previous = useRef<Map<string, ExplainerJob["state"]>>(new Map());
  useEffect(() => {
    const jobs = query.data;
    if (!jobs) return;
    const finished = jobs.some((job) => {
      const before = previous.current.get(job.jobId);
      return (
        before !== undefined &&
        ACTIVE_JOB_STATES.includes(before) &&
        !ACTIVE_JOB_STATES.includes(job.state)
      );
    });
    previous.current = new Map(jobs.map((job) => [job.jobId, job.state]));
    if (finished) {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: VIDEOS_KEY });
    }
  }, [query.data, queryClient]);
  return query;
}

export function useCaptureThumbnails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (videoId: string) => captureThumbnails(videoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VIDEOS_KEY }),
  });
}

export function useChooseThumbnail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { videoId: string; option: ThumbnailOptionId }) =>
      chooseThumbnail(input.videoId, input.option),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VIDEOS_KEY }),
  });
}

export function useGeneratePublishTexts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { videoId: string; provider?: TextProvider; overwrite?: boolean }) =>
      generatePublishTexts(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VIDEOS_KEY }),
  });
}

export function useExplainerOptions(categoryPath?: string) {
  return useQuery({
    queryKey: ["explainer-options", categoryPath ?? "default"],
    queryFn: ({ signal }) => getExplainerOptions(categoryPath, signal),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCategoryDesigns(categoryPath: string | null) {
  return useQuery({
    queryKey: ["explainer-designs", categoryPath],
    queryFn: ({ signal }) => getCategoryDesigns(categoryPath ?? "", signal),
    enabled: Boolean(categoryPath),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useDesignGroups(first: string | null) {
  return useQuery({
    queryKey: ["explainer-design-groups", first],
    queryFn: ({ signal }) => getDesignGroups(first ?? "", signal),
    enabled: Boolean(first),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useGenerateBrief() {
  return useMutation({ mutationFn: (input: BriefInput) => generateBrief(input) });
}

export function useCreateProduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductionInput) => createProduction(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTIONS_KEY }),
  });
}

function hasActive(productions: Production[]): boolean {
  return productions.some((p) => ACTIVE_PRODUCTION_STATES.includes(p.state));
}

/** Producciones de una categoría; refresca cada 5 s mientras alguna está en curso.
 * Cuando una producción sale de un estado activo, el video aparece (o cambia)
 * en Preparación, así que también se refrescan los videos. */
export function useProductions(categoryPath?: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [...PRODUCTIONS_KEY, categoryPath ?? "all"],
    queryFn: ({ signal }) => getProductions(categoryPath, signal),
    refetchInterval: (q) => (hasActive((q.state.data ?? []) as Production[]) ? POLL_MS : false),
    refetchOnWindowFocus: false,
  });

  const previous = useRef<Map<string, Production["state"]>>(new Map());
  useEffect(() => {
    const data = query.data;
    if (!data) return;
    const finished = data.some((p) => {
      const before = previous.current.get(p.productionId);
      return (
        before !== undefined &&
        before !== p.state &&
        ACTIVE_PRODUCTION_STATES.includes(before) &&
        !ACTIVE_PRODUCTION_STATES.includes(p.state)
      );
    });
    previous.current = new Map(data.map((p) => [p.productionId, p.state]));
    if (finished) queryClient.invalidateQueries({ queryKey: VIDEOS_KEY });
  }, [query.data, queryClient]);

  return query;
}

/** Una producción con la cola del log (solo mientras el log está abierto). */
export function useProduction(productionId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...PRODUCTIONS_KEY, "detail", productionId],
    queryFn: ({ signal }) => getProduction(productionId, signal),
    enabled,
    refetchInterval: (q) => {
      const state = (q.state.data as Production | undefined)?.state;
      return state && ACTIVE_PRODUCTION_STATES.includes(state) ? POLL_MS : false;
    },
    refetchOnWindowFocus: false,
  });
}

export function useResumeProduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productionId: string) => resumeProduction(productionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PRODUCTIONS_KEY }),
  });
}

export interface PublishAccount {
  selector: string;
  label: string;
  platform: string;
  group: string;
}

interface AccountDto {
  platform: string;
  alias: string;
  name: string;
  label?: string;
}

const PUBLISHABLE = ["youtube", "tiktok", "facebook", "instagram"];

export function usePublishAccounts() {
  return useQuery({
    queryKey: ["publish-accounts"],
    queryFn: async ({ signal }): Promise<PublishAccount[]> => {
      const dtos = await httpClient<AccountDto[]>("/api/v1/publish/accounts", { signal });
      return dtos
        .filter((dto) => PUBLISHABLE.includes(dto.platform))
        .map((dto) => ({
          selector: dto.platform + ":" + dto.alias,
          label: dto.platform + " · " + (dto.name || dto.alias),
          platform: dto.platform,
          group: dto.name?.trim() || dto.label?.trim() || dto.alias,
        }));
    },
    staleTime: 60_000,
  });
}
