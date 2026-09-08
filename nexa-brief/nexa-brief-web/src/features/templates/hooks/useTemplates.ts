import { useQuery } from "@tanstack/react-query";
import { getTemplates } from "../api/templates-service";

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: ({ signal }) => getTemplates(signal),
  });
}
