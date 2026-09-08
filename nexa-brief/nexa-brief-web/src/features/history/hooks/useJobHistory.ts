import { useQuery } from "@tanstack/react-query";
import { getJobHistory } from "../api/history-service";

export function useJobHistory(jobId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["history", "job", jobId] as const,
    queryFn: ({ signal }) => getJobHistory(jobId, signal),
    enabled: options.enabled ?? Boolean(jobId),
    refetchInterval: 10_000,
    retry: 1,
  });
}
