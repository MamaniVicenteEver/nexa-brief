import { useQuery } from "@tanstack/react-query";
import { getScheduleSlots, type ScheduleSlotFilters } from "../api/schedule-service";

const SCHEDULE_SLOTS_QUERY_KEY = ["scheduleSlots"] as const;

export function useScheduleSlots(filters: ScheduleSlotFilters = {}) {
  return useQuery({
    queryKey: [...SCHEDULE_SLOTS_QUERY_KEY, filters],
    queryFn: ({ signal }) => getScheduleSlots(filters, signal),
  });
}

export { SCHEDULE_SLOTS_QUERY_KEY };
