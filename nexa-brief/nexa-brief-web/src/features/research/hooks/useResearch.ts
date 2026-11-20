"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getResearchCategories,
  getResearchDetail,
  getResearchPage,
  syncResearch,
} from "../api/research-service";
import type { ResearchPageParams } from "../domain/research";

const RESEARCH_KEY = ["research"] as const;

export function useResearchPage(params: ResearchPageParams) {
  return useQuery({
    queryKey: [...RESEARCH_KEY, "page", params],
    queryFn: ({ signal }) => getResearchPage(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useResearchCategories() {
  return useQuery({
    queryKey: [...RESEARCH_KEY, "categories"],
    queryFn: ({ signal }) => getResearchCategories(signal),
  });
}

export function useResearchDetail(researchId: string | null) {
  return useQuery({
    queryKey: [...RESEARCH_KEY, "detail", researchId],
    queryFn: ({ signal }) => getResearchDetail(researchId as string, signal),
    enabled: Boolean(researchId),
  });
}

/** Registra las investigaciones de las carpetas que aún no están en la librería. */
export function useResearchSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => syncResearch(),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: RESEARCH_KEY });
    },
  });
}
