import { useQuery } from "@tanstack/react-query";
import { type ListHistoryParams, listHistory } from "../api/history-service";

const HISTORY_QUERY_KEY = ["history"] as const;

/** El historial es un log, no un estado que cambie a cada segundo — un
 * intervalo de 10s alcanza para ver jobs en curso avanzar sin recargar. */
export function useHistory(params: ListHistoryParams = {}) {
  return useQuery({
    queryKey: [...HISTORY_QUERY_KEY, params],
    queryFn: ({ signal }) => listHistory(params, signal),
    refetchInterval: 10_000,
    retry: 1,
  });
}

export { HISTORY_QUERY_KEY };
