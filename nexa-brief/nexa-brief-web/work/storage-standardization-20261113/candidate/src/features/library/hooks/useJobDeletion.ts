import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteJob, getJobPublications } from "../api/job-deletion-service";
import { JOBS_QUERY_KEY } from "./useJobs";

export function useJobPublications(jobId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["job-publications", jobId],
    queryFn: ({ signal }) => getJobPublications(jobId, signal),
    enabled,
    staleTime: 0,
  });
}

/** Tras borrar (aunque sea parcial) se refresca todo lo que muestra ese video:
 * Biblioteca, la cola de publicación y la lista/contador de cada canal. */
export function useDeleteJobMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, remote }: { jobId: string; remote: boolean }) => deleteJob(jobId, remote),
    onSettled: (_data, _error, { jobId }) => {
      for (const key of [JOBS_QUERY_KEY, ["scheduleQueue"], ["channels"], ["channel-videos"]]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      queryClient.invalidateQueries({ queryKey: ["job-publications", jobId] });
    },
  });
}
