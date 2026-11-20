import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteScheduleSlot } from "../api/schedule-service";
import { SCHEDULE_SLOTS_QUERY_KEY } from "./useScheduleSlots";

export function useDeleteScheduleSlotMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slotId: string) => deleteScheduleSlot(slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULE_SLOTS_QUERY_KEY });
    },
  });
}
