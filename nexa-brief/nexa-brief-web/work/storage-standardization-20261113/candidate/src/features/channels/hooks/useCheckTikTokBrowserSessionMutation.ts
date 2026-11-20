"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { checkTikTokBrowserSession } from "../api/channels-service";

export function useCheckTikTokBrowserSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: checkTikTokBrowserSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channels"] }),
  });
}
