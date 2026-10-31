import { useQuery } from "@tanstack/react-query";
import { fetchSandboxInfo } from "../api/sandbox-service";

export function useSandboxInfo(folder: string, id: string, enabled = true) {
  return useQuery({
    queryKey: ["explainer-sandbox-info", folder, id],
    queryFn: ({ signal }) => fetchSandboxInfo(folder, id, signal),
    enabled: enabled && Boolean(folder) && Boolean(id),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
