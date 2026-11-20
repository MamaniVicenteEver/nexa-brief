import { useQueries } from "@tanstack/react-query";
import { getJobStatus } from "../api/job-status-service";
import { deriveJobProgress, type JobProgressView } from "../lib/job-progress";

export type JobsSummary = Record<JobProgressView["status"], string[]>;

/** Status of each tracked job, grouped — reads the same ["job-status", id] cache the cards
 * keep fresh (each card's useJobStatus owns realtime/polling), so this adds no extra requests. */
export function useTrackedJobsSummary(jobIds: string[]): JobsSummary {
  const results = useQueries({
    queries: jobIds.map((jobId) => ({
      queryKey: ["job-status", jobId],
      queryFn: ({ signal }: { signal: AbortSignal }) => getJobStatus(jobId, signal),
      staleTime: Number.POSITIVE_INFINITY,
      retry: false,
    })),
  });

  const summary: JobsSummary = { queued: [], running: [], done: [], failed: [] };
  results.forEach((result, index) => {
    summary[deriveJobProgress(result.data, "pending").status].push(jobIds[index]);
  });
  return summary;
}
