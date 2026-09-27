import { useQuery } from "@tanstack/react-query";
import { getJobs } from "../api/jobs-list-service";

const JOBS_QUERY_KEY = ["jobs"] as const;

export function useJobs() {
  return useQuery({
    queryKey: JOBS_QUERY_KEY,
    queryFn: ({ signal }) => getJobs(signal),
  });
}

export { JOBS_QUERY_KEY };
