import { useMutation, useQueryClient } from "@tanstack/react-query";
import { JOBS_QUERY_KEY } from "@/features/library";
import { publishNow } from "../api/schedule-service";
import type { PublishNowInput } from "../types";
import { QUEUE_QUERY_KEY } from "./useQueueEntries";

export function usePublishNowMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PublishNowInput) => publishNow(input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["job-publications", input.jobId] });
    },
  });
}
