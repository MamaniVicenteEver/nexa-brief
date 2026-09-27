import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent } from "@/features/realtime";
import { getDashboardSummary } from "../api/stats-service";

export const DASHBOARD_QUERY_KEY = ["dashboard-summary"] as const;

/** Se refresca solo con cualquier cambio relevante (cola, canales, videos);
 * el intervalo lento es red de seguridad para cambios sin evento (ej. un
 * video que termina de generarse). */
export function useDashboardSummary() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });

  useRealtimeEvent("queue_entry_changed", invalidate);
  useRealtimeEvent("channel_status_changed", invalidate);
  useRealtimeEvent("job_deleted", invalidate);
  useRealtimeEvent("notification_created", invalidate);

  return useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: ({ signal }) => getDashboardSummary(signal),
    refetchInterval: 30_000,
  });
}
