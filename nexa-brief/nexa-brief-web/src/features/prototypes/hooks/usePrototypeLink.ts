import { useMutation } from "@tanstack/react-query";
import { fetchPrototypeLink } from "../api/prototype-service";
import type { PrototypeCategory } from "../types";

export function usePrototypeLink() {
  return useMutation({
    mutationFn: ({ category, slug }: { category: PrototypeCategory; slug: string }) =>
      fetchPrototypeLink(category, slug),
  });
}
