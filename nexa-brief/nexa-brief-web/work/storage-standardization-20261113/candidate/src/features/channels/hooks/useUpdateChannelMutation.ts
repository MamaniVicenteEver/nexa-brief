import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateChannel } from "../api/channels-service";
import type { ChannelAccount, ChannelAccountUpdate, ChannelPlatform } from "../types";
import { CHANNELS_QUERY_KEY } from "./useChannels";

export function useUpdateChannelMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      platform,
      alias,
      update,
    }: {
      platform: ChannelPlatform;
      alias: string;
      update: ChannelAccountUpdate;
    }) => updateChannel(platform, alias, update),
    onSuccess: (updated) => {
      queryClient.setQueryData<ChannelAccount[]>(CHANNELS_QUERY_KEY, (prev) =>
        prev?.map((a) =>
          a.platform === updated.platform && a.alias === updated.alias ? updated : a,
        ),
      );
    },
  });
}
