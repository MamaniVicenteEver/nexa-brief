import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent } from "@/features/realtime";
import { type ListNotificationsParams, listNotifications } from "../api/notifications-service";

const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

/** A `notification_created` event invalidates every notifications query
 * (the bell's `limit:5` and `/notificaciones`'s `limit:50` both match the
 * `["notifications"]` prefix), instead of polling every 15s regardless of
 * whether anything actually changed. The slow interval below is just a
 * safety net in case an event was ever missed while disconnected. */
export function useNotifications(params: ListNotificationsParams = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, params],
    queryFn: ({ signal }) => listNotifications(params, signal),
    refetchInterval: 120_000,
    retry: 1,
  });

  useRealtimeEvent("notification_created", () => {
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
  });

  return query;
}

export { NOTIFICATIONS_QUERY_KEY };
