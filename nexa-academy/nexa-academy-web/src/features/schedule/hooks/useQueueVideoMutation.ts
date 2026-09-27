import { useMutation, useQueryClient } from "@tanstack/react-query";
import { JOBS_QUERY_KEY } from "@/features/library";
import { queueVideo } from "../api/schedule-service";
import type { QueueVideoInput } from "../types";
import { QUEUE_QUERY_KEY } from "./useQueueEntries";

export function useQueueVideoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: QueueVideoInput) => queueVideo(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEY });
    },
  });
}
