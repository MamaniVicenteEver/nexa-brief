import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshChannelProfile } from "../api/channels-service";
import type { ChannelAccount } from "../types";
import { CHANNELS_QUERY_KEY } from "./useChannels";

export function useRefreshChannelProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ platform, alias }: { platform: ChannelAccount["platform"]; alias: string }) =>
      refreshChannelProfile(platform, alias),
    onSuccess: (updated) => {
      queryClient.setQueryData<ChannelAccount[]>(CHANNELS_QUERY_KEY, (previous) =>
        previous?.map((account) =>
          account.platform === updated.platform && account.alias === updated.alias
            ? updated
            : account,
        ),
      );
    },
  });
}
