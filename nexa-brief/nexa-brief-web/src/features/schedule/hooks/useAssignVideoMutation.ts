import { useMutation, useQueryClient } from "@tanstack/react-query";
import { assignVideoToSlot } from "../api/schedule-service";
import type { AssignVideoInput } from "../types";
import { QUEUE_QUERY_KEY } from "./useQueueEntries";
import { SCHEDULE_SLOTS_QUERY_KEY } from "./useScheduleSlots";

export function useAssignVideoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slotId, input }: { slotId: string; input: AssignVideoInput }) =>
      assignVideoToSlot(slotId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULE_SLOTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY });
    },
  });
}
