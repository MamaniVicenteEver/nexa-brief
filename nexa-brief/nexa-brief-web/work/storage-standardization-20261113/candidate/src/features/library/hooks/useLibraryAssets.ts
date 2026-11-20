import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getLibraryAssets,
  type LibraryAssetKind,
  type LibrarySearchParams,
} from "../api/library-assets-service";

/** Prefijo de todas las queries de assets de un tipo: invalidarlo refresca
 * tanto el listado completo como cualquier búsqueda filtrada. */
export const libraryAssetsKey = (kind: LibraryAssetKind) => ["library-assets", kind] as const;

export function useLibraryAssets(
  kind: LibraryAssetKind,
  enabled = true,
  params: LibrarySearchParams = {},
) {
  const q = params.q?.trim() ?? "";
  const category = params.category ?? "";
  return useQuery({
    // Sin filtros conserva la key histórica ["library-assets", kind].
    queryKey: q || category ? [...libraryAssetsKey(kind), { q, category }] : libraryAssetsKey(kind),
    queryFn: ({ signal }) => getLibraryAssets(kind, signal, { q, category }),
    enabled,
  });
}

/** Valor retrasado: para que la búsqueda no dispare un request por tecla. */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
