import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ACTIVE_PRODUCTION_STATES, type ProductionState } from "@/features/explainer";
import {
  deletePlanItem,
  getPlanItems,
  plannerChat,
  producePlanItem,
  savePlanItems,
} from "../api/schedule-service";
import type { PlanItem, PlannerMessage, PlannerProvider, SavedPlanItem } from "../types";

const PLAN_ITEMS_QUERY_KEY = ["plannerItems"] as const;
const POLL_MS = 5_000;

export function usePlannerChatMutation() {
  return useMutation({
    mutationFn: (input: {
      messages: PlannerMessage[];
      weekStart?: string;
      provider?: PlannerProvider;
    }) => plannerChat(input),
  });
}

/** Plan guardado; refresca mientras alguna producción del plan está en curso. */
export function usePlanItems(fromDate?: string) {
  return useQuery({
    queryKey: [...PLAN_ITEMS_QUERY_KEY, fromDate ?? "all"],
    queryFn: ({ signal }) => getPlanItems(fromDate, signal),
    refetchInterval: (query) => {
      const items = (query.state.data ?? []) as SavedPlanItem[];
      const busy = items.some(
        (item) =>
          item.productionState !== null &&
          ACTIVE_PRODUCTION_STATES.includes(item.productionState as ProductionState),
      );
      return busy ? POLL_MS : false;
    },
  });
}

export function useSavePlanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: PlanItem[]) => savePlanItems(items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLAN_ITEMS_QUERY_KEY }),
  });
}

export function useDeletePlanItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => deletePlanItem(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLAN_ITEMS_QUERY_KEY }),
  });
}

export function useProducePlanItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { itemId: string; agent?: string; autoRecord?: boolean }) =>
      producePlanItem(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_ITEMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["explainer-productions"] });
    },
  });
}
