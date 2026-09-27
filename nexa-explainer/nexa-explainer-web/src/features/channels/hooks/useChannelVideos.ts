import { useQuery } from "@tanstack/react-query";
import { getChannelVideos } from "../api/channels-service";
import type { ChannelPlatform } from "../types";

/** Only fetched while the details dialog is open (`enabled`) — no reason to
 * poll this per-channel list in the background like `useChannels` does. */
export function useChannelVideos(platform: ChannelPlatform, alias: string, enabled: boolean) {
  return useQuery({
    queryKey: ["channel-videos", platform, alias],
    queryFn: ({ signal }) => getChannelVideos(platform, alias, signal),
    enabled,
  });
}
