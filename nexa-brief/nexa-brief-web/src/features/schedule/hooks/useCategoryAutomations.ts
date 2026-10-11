import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCategoryAutomations, saveCategoryAutomation } from "../api/schedule-service";
import type { CategoryAutomationInput } from "../types";
import { SCHEDULE_SLOTS_QUERY_KEY } from "./useScheduleSlots";

const CATEGORY_AUTOMATIONS_QUERY_KEY = ["scheduleCategories"] as const;

export function useCategoryAutomations() {
  return useQuery({
    queryKey: CATEGORY_AUTOMATIONS_QUERY_KEY,
    queryFn: ({ signal }) => getCategoryAutomations(signal),
  });
}

/** Reemplaza los horarios de la categoría en esos canales; refresca también la tabla de horarios. */
export function useSaveCategoryAutomationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryAutomationInput) => saveCategoryAutomation(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORY_AUTOMATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SCHEDULE_SLOTS_QUERY_KEY });
    },
  });
}

export { CATEGORY_AUTOMATIONS_QUERY_KEY };
