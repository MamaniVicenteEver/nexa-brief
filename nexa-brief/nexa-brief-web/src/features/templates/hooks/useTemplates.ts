import { useQuery } from "@tanstack/react-query";
import { getTemplates } from "../api/templates-service";

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: ({ signal }) => getTemplates(signal),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
