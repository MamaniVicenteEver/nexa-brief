import { useQuery } from "@tanstack/react-query";
import { getMediaPlan } from "../api/studio-service";

/** El plan se arma en segundo plano: polling hasta que deje de estar "planning". */
export function useMediaPlan(planId: string | null) {
  return useQuery({
    queryKey: ["media-plan", planId],
    queryFn: ({ signal }) => getMediaPlan(planId as string, signal),
    enabled: planId !== null,
    refetchInterval: (q) => (q.state.data?.status === "planning" || !q.state.data ? 1_500 : false),
    refetchOnWindowFocus: false,
  });
}
