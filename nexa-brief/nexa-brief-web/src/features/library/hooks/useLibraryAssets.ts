import { useQuery } from "@tanstack/react-query";
import { getLibraryAssets, type LibraryAssetKind } from "../api/library-assets-service";

export function useLibraryAssets(kind: LibraryAssetKind, enabled = true) {
  return useQuery({
    queryKey: ["library-assets", kind],
    queryFn: ({ signal }) => getLibraryAssets(kind, signal),
    enabled,
  });
}
