import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createCategory } from "../api/categories-service";

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
