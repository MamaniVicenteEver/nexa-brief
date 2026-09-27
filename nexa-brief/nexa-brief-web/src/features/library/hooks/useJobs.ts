import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent } from "@/features/realtime";
import { getJobs } from "../api/jobs-list-service";

const JOBS_QUERY_KEY = ["jobs"] as const;

/** Mientras haya algún job generándose se refresca cada 10s para que
 * Biblioteca muestre el avance sin recargar; con todo terminado no pollea. */
export function useJobs() {
  const queryClient = useQueryClient();
  // Un video borrado desde otra pestaña/pantalla desaparece sin recargar.
  useRealtimeEvent("job_deleted", () => {
    queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEY });
  });

  return useQuery({
    queryKey: JOBS_QUERY_KEY,
    queryFn: ({ signal }) => getJobs(signal),
    refetchInterval: (query) => (query.state.data?.some((job) => !job.isTerminal) ? 10_000 : false),
  });
}

export { JOBS_QUERY_KEY };
