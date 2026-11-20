"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { standardShowcaseRepository as repository } from "../api/standard-showcase-repository";

export function useStandardShowcase(id: string, estilo?: string, format = "16x9") {
  const client = useQueryClient();
  const designs = useQuery({
    queryKey: ["showcase-standard", "designs"],
    queryFn: ({ signal }) => repository.designs(signal),
  });
  const catalog = useQuery({
    queryKey: ["showcase-standard", "catalog", id, estilo, format],
    queryFn: ({ signal }) => repository.catalog(id, signal, estilo, format),
    enabled: !!id,
    placeholderData: (previous) => previous,
  });
  const promote = useMutation({
    mutationFn: repository.promote,
    onSuccess: async () => {
      await Promise.all([
        ["showcase-standard"],
        ["templates", "catalog"],
        ["categories"],
        ["explainer-videos"],
        ["explainer-sandbox"],
        ["sandbox-showcase-visibility"],
      ].map((queryKey) => client.invalidateQueries({ queryKey })));
    },
  });
  return { designs, catalog, promote };
}
