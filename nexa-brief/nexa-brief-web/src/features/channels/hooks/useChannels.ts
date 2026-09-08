import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent } from "@/features/realtime";
import { getChannels } from "../api/channels-service";

const CHANNELS_QUERY_KEY = ["channels"] as const;

/** A `channel_status_changed` event (connect/disconnect/token expired —
 * see backend `_update_channels_json`/`disconnect_account`/
 * `mark_requires_reauth`) invalidates the list so it refetches once, instead
 * of polling every 15s regardless of whether anything changed.
 *
 * `poll: true` keeps a slow safety-net refresh (2 min) in case an event was
 * ever missed — meant for `/canales`, a monitoring page. Anywhere else (e.g.
 * the "Publicar en" selector while creating a video) a single load plus push
 * is enough; there's no dashboard sitting open waiting for updates. */
export function useChannels({ poll = false }: { poll?: boolean } = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: ({ signal }) => getChannels(signal),
    refetchInterval: poll ? 120_000 : false,
    retry: 1,
  });

  useRealtimeEvent("channel_status_changed", () => {
    queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
  });

  return query;
}

export { CHANNELS_QUERY_KEY };
