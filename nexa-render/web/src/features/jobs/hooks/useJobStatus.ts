"use client";

import { useQuery } from "@tanstack/react-query";
import type { JobStatus } from "@/infrastructure/api/types";
import { getJobStatus } from "../api/jobs";

export function isTerminal(status: JobStatus | undefined): boolean {
  return status === "completed" || status === "failed";
}

export function useJobStatus(jobId: string) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJobStatus(jobId),
    refetchInterval: (query) => (isTerminal(query.state.data?.status) ? false : 2000),
  });
}
