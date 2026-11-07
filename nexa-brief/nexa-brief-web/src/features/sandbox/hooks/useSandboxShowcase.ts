"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchShowcaseVisibility, setShowcaseVisibility } from "../api/showcase-visibility";

export const SANDBOX_SHOWCASE_QUERY_KEY = ["sandbox-showcase-visibility"] as const;

export function useSandboxShowcase() {
  return useQuery({
    queryKey: SANDBOX_SHOWCASE_QUERY_KEY,
    queryFn: ({ signal }) => fetchShowcaseVisibility(signal),
    staleTime: 30_000,
  });
}

export function useSandboxShowcaseToggle(folder: string, id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (visible: boolean) => setShowcaseVisibility(folder, id, visible),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: SANDBOX_SHOWCASE_QUERY_KEY }),
        client.invalidateQueries({ queryKey: ["showcase-standard"] }),
      ]);
    },
  });
}
