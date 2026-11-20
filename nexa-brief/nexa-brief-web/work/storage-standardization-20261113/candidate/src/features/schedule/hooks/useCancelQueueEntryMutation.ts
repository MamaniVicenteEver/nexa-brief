import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelQueueEntry } from "../api/schedule-service";
import { QUEUE_QUERY_KEY } from "./useQueueEntries";

export function useCancelQueueEntryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entryId: string) => cancelQueueEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY });
    },
  });
}
