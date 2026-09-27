import { useMutation } from "@tanstack/react-query";
import { createVideoJob } from "../api/create-video-service";

export function useCreateVideoMutation() {
  return useMutation({
    mutationFn: (values: Parameters<typeof createVideoJob>[0]) => createVideoJob(values),
  });
}
