import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createScheduleSlot } from "../api/schedule-service";
import type { ScheduleSlotInput } from "../types";
import { SCHEDULE_SLOTS_QUERY_KEY } from "./useScheduleSlots";

export function useCreateScheduleSlotMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ScheduleSlotInput) => createScheduleSlot(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULE_SLOTS_QUERY_KEY });
    },
  });
}
