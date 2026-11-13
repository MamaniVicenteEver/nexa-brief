import { useQuery } from "@tanstack/react-query";
import { fetchImageCodePreview } from "../api/image-post-preview-api";
import type { ImagePostFormat } from "../image-formats";

export function useImageCodePreview({
  postId,
  slideId,
  format,
  revision,
}: {
  postId: string;
  slideId: string;
  format: ImagePostFormat;
  revision?: number;
}) {
  return useQuery({
    queryKey: ["image-posts", "code-preview", postId, revision, slideId, format],
    queryFn: ({ signal }) => fetchImageCodePreview(postId, slideId, format, signal),
    enabled: Boolean(postId && slideId),
    // The revision and format identify the editable document. Keep it warm while browsing.
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
