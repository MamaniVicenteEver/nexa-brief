"use client";

import { useQuery } from "@tanstack/react-query";
import { httpClient } from "@/infrastructure/api/http-client";
import type { ShowcaseStyles } from "../lib/showcase-style";

/** Se consulta al abrir; la identidad estable también resuelve episodios del perfil activo. */
export function useVisualStyles(id: string, enabled = true, folder?: string, episode?: string) {
  const query = new URLSearchParams();
  if (folder) query.set("folder", folder);
  if (episode) query.set("episode", episode);
  return useQuery({
    queryKey: ["showcase-standard", "styles", id, folder, episode],
    queryFn: ({ signal }) => httpClient<ShowcaseStyles>(
      `/api/v1/showcase/designs/${encodeURIComponent(id)}/styles${query.size ? `?${query}` : ""}`,
      { signal },
    ),
    enabled: enabled && !!id,
    staleTime: 60_000,
    retry: false,
  });
}
