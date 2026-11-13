import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateScheduleSlot } from "../api/schedule-service";
import type { ScheduleSlotUpdateInput } from "../types";
import { SCHEDULE_SLOTS_QUERY_KEY } from "./useScheduleSlots";

export function useUpdateScheduleSlotMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slotId, input }: { slotId: string; input: ScheduleSlotUpdateInput }) =>
      updateScheduleSlot(slotId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULE_SLOTS_QUERY_KEY });
    },
  });
}
