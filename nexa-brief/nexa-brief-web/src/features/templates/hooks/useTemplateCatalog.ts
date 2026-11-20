import { useQuery } from "@tanstack/react-query";
import { getTemplateCatalog } from "../api/template-catalog-service";

export function useTemplateCatalog() {
  return useQuery({
    queryKey: ["templates", "catalog"],
    queryFn: ({ signal }) => getTemplateCatalog(signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
