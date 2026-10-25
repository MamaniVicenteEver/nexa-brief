import { useQuery } from "@tanstack/react-query";
import { fetchSandbox } from "../api/sandbox-service";

export const SANDBOX_QUERY_KEY = ["explainer-sandbox"] as const;

export function useSandbox() {
  return useQuery({
    queryKey: SANDBOX_QUERY_KEY,
    queryFn: ({ signal }) => fetchSandbox(signal),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
