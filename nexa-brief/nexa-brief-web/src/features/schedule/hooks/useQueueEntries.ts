import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent } from "@/features/realtime";
import { getQueueEntries } from "../api/schedule-service";
import type { QueueEntryFilters } from "../types";

const QUEUE_QUERY_KEY = ["scheduleQueue"] as const;

/** Un evento `queue_entry_changed` invalida toda query de la cola (cualquier
 * combinación de filtros matchea el prefijo `["scheduleQueue"]`), en vez de
 * pollear cada 15s sin importar si algo cambió de verdad. El intervalo lento
 * de abajo es solo red de seguridad por si se perdió un evento desconectado. */
export function useQueueEntries(filters: QueueEntryFilters = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...QUEUE_QUERY_KEY, filters],
    queryFn: ({ signal }) => getQueueEntries(filters, signal),
    refetchInterval: 120_000,
  });

  useRealtimeEvent("queue_entry_changed", () => {
    queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY });
  });

  return query;
}

export { QUEUE_QUERY_KEY };
