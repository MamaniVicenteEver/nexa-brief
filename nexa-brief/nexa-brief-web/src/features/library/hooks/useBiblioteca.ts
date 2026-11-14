import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent } from "@/features/realtime";
import { ApiError } from "@/infrastructure/api/api-error";
import { getBibliotecaPage } from "../api/biblioteca-service";
import type { LibraryQuery } from "../domain/biblioteca";

// The existing jobs prefix preserves invalidation after deletion and recording.
export const bibliotecaKey = ["jobs", "biblioteca"] as const;
export function useBiblioteca(query: LibraryQuery) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: bibliotecaKey });
  };
  useRealtimeEvent("job_deleted", refresh);
  useRealtimeEvent("queue_entry_changed", refresh);
  useRealtimeEvent("image_post_changed", refresh);
  useRealtimeEvent("image_post_purged", refresh);
  useRealtimeEvent("image_delivery_changed", refresh);
  useRealtimeEvent("image_post_removal_changed", refresh);
  return useQuery({
    queryKey: [...bibliotecaKey, query],
    queryFn: ({ signal }) => getBibliotecaPage(query, signal),
    retry: (count, error) =>
      !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    refetchInterval: (result) => (result.state.data?.hasActiveJobs ? 10000 : false),
    refetchOnWindowFocus: true,
  });
}
