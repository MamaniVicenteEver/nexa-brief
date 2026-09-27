import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getNiches } from "@/features/create-video/api/niches-service";
import { humanizeCategory } from "../library-status";

/** id de nicho → nombre legible. Incluye nichos inactivos (a diferencia de
 * `useNiches`): un video viejo puede pertenecer a un nicho ya desactivado. */
export function useCategoryLabels() {
  const { data: niches } = useQuery({
    queryKey: ["niches", "all"],
    queryFn: ({ signal }) => getNiches(signal),
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const labels = new Map((niches ?? []).map((n) => [n.id, n.displayName]));
    return (category: string) => labels.get(category) ?? humanizeCategory(category);
  }, [niches]);
}
