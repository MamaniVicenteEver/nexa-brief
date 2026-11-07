import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { getExplainerJobs, getProductions } from "@/features/explainer/api/explainer-service";
import { getJobs } from "@/features/library/api/jobs-list-service";
import { useRealtimeEvent } from "@/features/realtime";
import { getCategoryAutomations, getPlanItems, getQueueEntries } from "../api/schedule-service";
import { buildAgenda } from "../lib/agenda";

/** Read-only monitoring. Polls also while idle to discover work submitted from another chat. */
export function useScheduleOverview() {
  const client = useQueryClient();
  const plans = useQuery({
    queryKey: ["plannerItems", "all"],
    queryFn: ({ signal }) => getPlanItems(undefined, signal),
    refetchInterval: 15_000,
  });
  const productions = useQuery({
    queryKey: ["explainer-productions", "all"],
    queryFn: ({ signal }) => getProductions(undefined, signal),
    refetchInterval: (q) =>
      q.state.data?.some((p) =>
        ["queued", "creating", "producing", "finishing", "recording"].includes(p.state),
      )
        ? 5_000
        : 15_000,
  });
  const recordings = useQuery({
    queryKey: ["explainer-recordings", "schedule"],
    queryFn: ({ signal }) => getExplainerJobs(signal, false),
    refetchInterval: (q) =>
      q.state.data?.some((r) => ["queued", "rendering", "publishing"].includes(r.state))
        ? 3_000
        : 15_000,
  });
  const publications = useQuery({
    queryKey: ["scheduleQueue", { limit: 200 }],
    queryFn: ({ signal }) => getQueueEntries({ limit: 200 }, signal),
    refetchInterval: 15_000,
  });
  const categories = useQuery({
    queryKey: ["scheduleCategories"],
    queryFn: ({ signal }) => getCategoryAutomations(signal),
    refetchInterval: 30_000,
  });
  const jobs = useQuery({
    queryKey: ["jobs"],
    queryFn: ({ signal }) => getJobs(signal),
    refetchInterval: 30_000,
  });
  useRealtimeEvent("queue_entry_changed", () => {
    client.invalidateQueries({ queryKey: ["scheduleQueue"] });
  });
  useRealtimeEvent("job_progress", () => {
    client.invalidateQueries({ queryKey: ["jobs"] });
  });
  const events = useMemo(
    () =>
      buildAgenda({
        plans: plans.data ?? [],
        productions: productions.data ?? [],
        recordings: recordings.data ?? [],
        publications: publications.data ?? [],
        jobs: jobs.data ?? [],
      }),
    [plans.data, productions.data, recordings.data, publications.data, jobs.data],
  );
  const queries = [plans, productions, recordings, publications, categories, jobs];
  return {
    events,
    jobs: jobs.data ?? [],
    categories: categories.data ?? [],
    isLoading: queries.some((q) => q.isLoading),
    isFetching: queries.some((q) => q.isFetching),
    hasError: queries.some((q) => q.isError),
    updatedAt: Math.min(...queries.map((q) => q.dataUpdatedAt).filter(Boolean)) || 0,
    refresh: () => Promise.all(queries.map((q) => q.refetch())),
  };
}
