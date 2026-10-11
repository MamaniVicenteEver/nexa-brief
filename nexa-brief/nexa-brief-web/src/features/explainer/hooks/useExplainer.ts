import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { httpClient } from "@/infrastructure/api/http-client";
import {
  createProduction,
  generateBrief,
  generatePublishTexts,
  getCategoryDesigns,
  getDesignGroups,
  getExplainerOptions,
  getExplainerVideos,
  getProduction,
  getProductions,
  recordExplainerVideo,
  resumeProduction,
} from "../api/explainer-service";
import {
  ACTIVE_JOB_STATES,
  ACTIVE_PRODUCTION_STATES,
  type BriefInput,
  type CreateProductionInput,
  type ExplainerVideo,
  type Production,
  type RecordExplainerInput,
  type TextProvider,
} from "../types";

const POLL_MS = 5_000;
const VIDEOS_KEY = ["explainer-videos"] as const;
const PRODUCTIONS_KEY = ["explainer-productions"] as const;

/** Sin `categoryPath` trae todos los videos; con él, solo los de esa categoría. */
export function useExplainerVideos(categoryPath?: string) {
  return useQuery({
    queryKey: [...VIDEOS_KEY, categoryPath ?? "all"],
    queryFn: ({ signal }) => getExplainerVideos(categoryPath, signal),
    // Mientras haya una grabación en curso, refresca para ver el progreso.
    refetchInterval: (query) => {
      const videos = (query.state.data ?? []) as ExplainerVideo[];
      const busy = videos.some((v) => v.lastJob && ACTIVE_JOB_STATES.includes(v.lastJob.state));
      return busy ? POLL_MS : false;
    },
    refetchOnWindowFocus: false,
  });
}

export function useRecordExplainerVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordExplainerInput) => recordExplainerVideo(input),
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

export function useExplainerOptions() {
  return useQuery({
    queryKey: ["explainer-options"],
    queryFn: ({ signal }) => getExplainerOptions(signal),
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
}

interface AccountDto {
  platform: string;
  alias: string;
  name: string;
}

const PUBLISHABLE = ["youtube", "tiktok", "facebook"];

export function usePublishAccounts() {
  return useQuery({
    queryKey: ["publish-accounts"],
    queryFn: async ({ signal }): Promise<PublishAccount[]> => {
      const dtos = await httpClient<AccountDto[]>("/api/v1/publish/accounts", { signal });
      return dtos
        .filter((dto) => PUBLISHABLE.includes(dto.platform))
        .map((dto) => ({
          selector: `${dto.platform}:${dto.alias}`,
          label: `${dto.platform} · ${dto.name || dto.alias}`,
        }));
    },
    staleTime: 60_000,
  });
}
