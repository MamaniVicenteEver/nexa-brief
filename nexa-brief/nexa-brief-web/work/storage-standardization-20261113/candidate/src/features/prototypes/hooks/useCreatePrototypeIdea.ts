import { useMutation } from "@tanstack/react-query";
import { createPrototypeIdea } from "../api/prototype-service";
import type { CreatePrototypeIdeaInput } from "../types";

export function useCreatePrototypeIdea() {
  return useMutation({
    mutationFn: ({
      input,
      onProgress,
    }: {
      input: CreatePrototypeIdeaInput;
      onProgress: (percent: number) => void;
    }) => createPrototypeIdea(input, onProgress),
  });
}
