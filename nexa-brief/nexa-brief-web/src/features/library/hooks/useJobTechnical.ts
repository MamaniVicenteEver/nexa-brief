import { useQuery } from "@tanstack/react-query";
import { getJobTechnical } from "../api/job-technical-service";

/** Ficha técnica del video: solo cambia si se vuelve a grabar, así que se cachea un rato. */
export function useJobTechnical(jobId: string, enabled = true) {
  return useQuery({
    queryKey: ["job-technical", jobId],
    queryFn: ({ signal }) => getJobTechnical(jobId, signal),
    enabled,
    staleTime: 5 * 60_000,
  });
}
