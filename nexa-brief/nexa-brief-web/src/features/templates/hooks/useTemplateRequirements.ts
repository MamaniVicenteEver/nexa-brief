import { useQuery } from "@tanstack/react-query";
import { getTemplateRequirements } from "../api/templates-service";

/** Los requisitos salen de templates.json: no cambian mientras corre el server. */
export function useTemplateRequirements(templateId: string, enabled = true) {
  return useQuery({
    queryKey: ["template-requirements", templateId],
    queryFn: ({ signal }) => getTemplateRequirements(templateId, signal),
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
    gcTime: 30 * 60 * 1000,
  });
}
