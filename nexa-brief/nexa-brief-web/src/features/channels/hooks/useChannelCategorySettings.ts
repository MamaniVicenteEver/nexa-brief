import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent } from "@/features/realtime";
import { getChannelCategorySettings } from "../api/channel-categories-service";

export const CHANNEL_CATEGORY_SETTINGS_KEY = ["channelCategorySettings"] as const;

export function useChannelCategorySettings(poll = false) {
  const client = useQueryClient();
  useRealtimeEvent("channel_categories_changed", () => {
    void client.invalidateQueries({ queryKey: CHANNEL_CATEGORY_SETTINGS_KEY });
  });
  return useQuery({
    queryKey: CHANNEL_CATEGORY_SETTINGS_KEY,
    queryFn: ({ signal }) => getChannelCategorySettings(signal),
    staleTime: 30_000,
    refetchInterval: poll ? 60_000 : false,
    retry: 1,
  });
}
