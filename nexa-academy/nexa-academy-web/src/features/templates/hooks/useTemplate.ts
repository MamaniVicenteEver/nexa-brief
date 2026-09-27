import { useQuery } from "@tanstack/react-query";
import { getTemplate } from "../api/templates-service";

export function useTemplate(templateId: string) {
  return useQuery({
    queryKey: ["template", templateId],
    queryFn: ({ signal }) => getTemplate(templateId, signal),
  });
}
