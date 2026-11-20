import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deletePublishedVideo } from "../api/channels-service";
import type { ChannelPlatform } from "../types";
import { CHANNELS_QUERY_KEY } from "./useChannels";

export function useDeletePublishedVideoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      platform,
      alias,
      postId,
    }: {
      platform: ChannelPlatform;
      alias: string;
      postId: string;
    }) => deletePublishedVideo(platform, alias, postId),
    onSuccess: (_data, { platform, alias }) => {
      queryClient.invalidateQueries({ queryKey: ["channel-videos", platform, alias] });
      queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
      // Biblioteca deriva "Publicado" de la cola: la entry ahora quedó `removed`.
      queryClient.invalidateQueries({ queryKey: ["scheduleQueue"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}
