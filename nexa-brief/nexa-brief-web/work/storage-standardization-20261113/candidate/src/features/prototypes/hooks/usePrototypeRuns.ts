import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelPrototypeRun,
  createPrototypeRun,
  fetchPrototypeRun,
  fetchPrototypeRuns,
} from "../api/prototype-service";
import type { CreatePrototypeRunInput, PrototypeCategory, PrototypeRunState } from "../types";

const RUNS_KEY = "prototype-runs";
const ACTIVE_STATES: PrototypeRunState[] = ["queued", "running"];

export function prototypeRunsQueryKey(category: PrototypeCategory, slug: string) {
  return [RUNS_KEY, category, slug] as const;
}

export function usePrototypeRuns(category: PrototypeCategory, slug: string) {
  return useQuery({
    queryKey: prototypeRunsQueryKey(category, slug),
    queryFn: ({ signal }) => fetchPrototypeRuns(category, slug, signal),
    refetchInterval: (query) =>
      query.state.data?.some((run) => ACTIVE_STATES.includes(run.state)) ? 2_000 : false,
  });
}

export function usePrototypeRun(runId: string, enabled: boolean) {
  return useQuery({
    queryKey: [RUNS_KEY, "detail", runId],
    queryFn: ({ signal }) => fetchPrototypeRun(runId, signal),
    enabled,
    refetchInterval: (query) =>
      query.state.data && ACTIVE_STATES.includes(query.state.data.state) ? 1_500 : false,
  });
}

export function useCreatePrototypeRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePrototypeRunInput) => createPrototypeRun(input),
    onSuccess: (run) =>
      queryClient.invalidateQueries({ queryKey: prototypeRunsQueryKey(run.category, run.idea_id) }),
  });
}

export function useCancelPrototypeRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => cancelPrototypeRun(runId),
    onSuccess: (run) => {
      void queryClient.invalidateQueries({ queryKey: [RUNS_KEY, run.category, run.idea_id] });
      void queryClient.invalidateQueries({ queryKey: [RUNS_KEY, "detail", run.run_id] });
    },
  });
}
