import { useMutation, useQueryClient } from "@tanstack/react-query";
import { disconnectChannel } from "../api/channels-service";
import type { ChannelPlatform } from "../types";
import { CHANNELS_QUERY_KEY } from "./useChannels";

export function useDisconnectChannelMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ platform, alias }: { platform: ChannelPlatform; alias: string }) =>
      disconnectChannel(platform, alias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
    },
  });
}
