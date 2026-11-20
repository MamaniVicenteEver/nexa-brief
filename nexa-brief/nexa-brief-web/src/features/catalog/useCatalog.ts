import { useQuery } from "@tanstack/react-query";
import { catalogService } from "./service";
import type { CatalogAudience, CatalogQuery } from "./types";

export function useCatalog(audience: CatalogAudience, query: CatalogQuery = {}) {
  return useQuery({
    queryKey: [
      "catalog",
      audience,
      query.category ?? "all",
      query.page ?? 1,
      query.pageSize ?? "all",
    ],
    queryFn: ({ signal }) => catalogService.list(audience, query, signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
