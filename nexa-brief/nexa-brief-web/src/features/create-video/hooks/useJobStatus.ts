import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent, useRealtimeStatus } from "@/features/realtime";
import {
  getJobStatus,
  type JobDetailDto,
  type JobProgressDto,
  mapJobDetail,
  mapJobProgress,
} from "../api/job-status-service";
import { isTerminalStage } from "../stage";
import type { JobDetail } from "../types";

/** Push replaces polling while the realtime socket is connected: each stage
 * change arrives as a `job_stage_changed` event carrying the full job detail
 * (see backend `_on_stage`), so `setQueryData` needs no follow-up fetch. The
 * 3s poll only kicks back in as a fallback while the socket is down — this
 * used to be the only mechanism (one independent poller per job card). */
export function useJobStatus(jobId: string) {
  const queryClient = useQueryClient();
  const isRealtimeConnected = useRealtimeStatus();

  const query = useQuery({
    queryKey: ["job-status", jobId],
    queryFn: ({ signal }) => getJobStatus(jobId, signal),
    refetchInterval: (q) => {
      if (isTerminalStage(q.state.data?.stage)) return false;
      return isRealtimeConnected ? false : 3000;
    },
    retry: false,
  });

  useRealtimeEvent<JobDetailDto>("job_stage_changed", (data) => {
    if (data.job_id !== jobId) return;
    queryClient.setQueryData(["job-status", jobId], mapJobDetail(data));
  });

  // Frequent, lightweight updates (queue position, %, ETA) between stage changes.
  useRealtimeEvent<JobProgressDto>("job_progress", (data) => {
    if (data.job_id !== jobId) return;
    queryClient.setQueryData<JobDetail>(["job-status", jobId], (prev) =>
      prev ? { ...prev, progress: mapJobProgress(data) } : prev,
    );
  });

  return query;
}
