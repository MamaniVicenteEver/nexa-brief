import { useMutation, useQuery } from "@tanstack/react-query";
import { importStockItem, type StockSearchParams, searchStock } from "../api/studio-service";

/** Búsqueda en Pexels/Pixabay/Unsplash. Los proveedores limitan búsquedas por
 * hora: sin reintentos y con caché larga (el backend además cachea 6–24 h). */
export function useStockSearch(params: StockSearchParams | null) {
  return useQuery({
    queryKey: ["stock-search", params],
    queryFn: ({ signal }) => searchStock(params as StockSearchParams, signal),
    enabled: params !== null && params.q.trim().length > 0,
    staleTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useImportStock() {
  return useMutation({ mutationFn: importStockItem });
}
