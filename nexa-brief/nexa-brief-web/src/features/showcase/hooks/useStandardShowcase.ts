"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { standardShowcaseRepository as repository } from "../api/standard-showcase-repository";

export function useStandardShowcase(id: string) {
  const client = useQueryClient();
  const designs = useQuery({
    queryKey: ["showcase-standard", "designs"],
    queryFn: ({ signal }) => repository.designs(signal),
  });
  const catalog = useQuery({
    queryKey: ["showcase-standard", "catalog", id],
    queryFn: ({ signal }) => repository.catalog(id, signal),
    enabled: !!id,
  });
  const promote = useMutation({
    mutationFn: repository.promote,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["showcase-standard"] });
    },
  });
  return { designs, catalog, promote };
}
