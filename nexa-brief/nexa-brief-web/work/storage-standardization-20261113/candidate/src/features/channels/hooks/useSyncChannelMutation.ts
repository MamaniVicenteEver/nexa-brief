import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncAccount } from "../api/channels-service";
import type { ChannelPlatform } from "../types";
import { CHANNELS_QUERY_KEY } from "./useChannels";

export function useSyncChannelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ platform, alias }: { platform: ChannelPlatform; alias: string }) =>
      syncAccount(platform, alias),
    onSuccess: (_result, { platform, alias }) => {
      queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["channel-videos", platform, alias] });
    },
  });
}
