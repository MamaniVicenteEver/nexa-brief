import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelImagePostDelivery,
  createPlan,
  getImageCapabilities,
  getImagePost,
  getImagePosts,
  getImageStrategies,
  getImageStyles,
  getPublicationDetail,
  getPublications,
  publishImageNow,
  reconcileImagePostDelivery,
  refreshPublicationMetrics,
  renderPlan,
  reviewImagePost,
  saveImagePost,
  scheduleImagePost,
} from "../image-posts-service";
import type { GalleryFilters, ImagePostPatch, MetricsWindow, Placement, Platform } from "../types";

export const IMAGE_POSTS_QUERY_KEY = ["image-posts"] as const;
export const PUBLICATIONS_QUERY_KEY = ["image-posts", "gallery"] as const;

export function useImagePosts(categoryId: string) {
  return useQuery({
    queryKey: [...IMAGE_POSTS_QUERY_KEY, "category", categoryId],
    queryFn: ({ signal }) => getImagePosts(categoryId, signal),
    enabled: Boolean(categoryId),
    staleTime: 15_000,
    refetchInterval: (query) =>
      query.state.data?.some((post) => post.status === "rendering")
        ? 3_000
        : query.state.data?.some((post) =>
              post.deliveries.some((delivery) => delivery.status === "outcome_unknown"),
            )
          ? 15_000
          : false,
    refetchOnWindowFocus: false,
  });
}

export function useImagePost(postId: string | null) {
  return useQuery({
    queryKey: [...IMAGE_POSTS_QUERY_KEY, "detail", postId],
    queryFn: ({ signal }) => getImagePost(postId ?? "", signal),
    enabled: Boolean(postId),
    staleTime: 3_000,
    refetchInterval: (query) =>
      query.state.data?.status === "rendering"
        ? 2_000
        : query.state.data?.deliveries.some((delivery) => delivery.status === "outcome_unknown")
          ? 15_000
          : false,
    refetchOnWindowFocus: false,
  });
}

export function useImageEditorOptions(categoryId: string) {
  const styles = useQuery({
    queryKey: [...IMAGE_POSTS_QUERY_KEY, "styles", categoryId],
    queryFn: ({ signal }) => getImageStyles(categoryId, signal),
    enabled: Boolean(categoryId),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const capabilities = useQuery({
    queryKey: [...IMAGE_POSTS_QUERY_KEY, "capabilities", categoryId],
    queryFn: ({ signal }) => getImageCapabilities(categoryId, signal),
    enabled: Boolean(categoryId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  return { styles, capabilities };
}

export function useImageStrategies() {
  return useQuery({
    queryKey: [...IMAGE_POSTS_QUERY_KEY, "strategies"],
    queryFn: ({ signal }) => getImageStrategies(signal),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePublications(filters: GalleryFilters) {
  return useInfiniteQuery({
    queryKey: [...PUBLICATIONS_QUERY_KEY, filters],
    queryFn: ({ signal, pageParam }) => getPublications(filters, signal, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function usePublicationDetail(publicationId: string | null) {
  return useQuery({
    queryKey: [...PUBLICATIONS_QUERY_KEY, "detail", publicationId],
    queryFn: ({ signal }) => getPublicationDetail(publicationId ?? "", signal),
    enabled: Boolean(publicationId),
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
}

export function usePublicationMetrics(
  publicationId: string | null,
  deliveryId: string | null,
  window: MetricsWindow,
) {
  return useQuery({
    queryKey: [...PUBLICATIONS_QUERY_KEY, "metrics", publicationId, deliveryId, window],
    queryFn: ({ signal }) =>
      refreshPublicationMetrics(publicationId ?? "", deliveryId ?? "", window, signal),
    enabled: Boolean(publicationId && deliveryId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useImagePostActions() {
  const queryClient = useQueryClient();
  const refresh = async (postId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: IMAGE_POSTS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PUBLICATIONS_QUERY_KEY }),
      ...(postId
        ? [
            queryClient.invalidateQueries({
              queryKey: [...IMAGE_POSTS_QUERY_KEY, "detail", postId],
            }),
          ]
        : []),
    ]);
  };

  const createPlanMutation = useMutation({ mutationFn: createPlan });
  const renderPlanMutation = useMutation({
    mutationFn: renderPlan,
    onSuccess: () => refresh(),
  });
  const saveMutation = useMutation({
    mutationFn: ({ postId, patch }: { postId: string; patch: ImagePostPatch }) =>
      saveImagePost(postId, patch),
    onSuccess: (post) => refresh(post.postId),
  });
  const reviewMutation = useMutation({
    mutationFn: ({
      postId,
      revision,
      decision,
      note,
    }: {
      postId: string;
      revision: number;
      decision: "approve" | "reject";
      note?: string;
    }) => reviewImagePost(postId, revision, decision, note),
    onSuccess: (post) => refresh(post.postId),
  });
  const scheduleMutation = useMutation({
    mutationFn: ({
      postId,
      revision,
      targets,
    }: {
      postId: string;
      revision: number;
      targets: Array<{
        platform: Platform;
        account_alias: string;
        placement: Placement;
        scheduled_at?: string;
      }>;
    }) => scheduleImagePost(postId, revision, targets),
    onSuccess: (_, input) => refresh(input.postId),
  });
  const publishMutation = useMutation({
    mutationFn: ({ deliveryId }: { postId: string; deliveryId: string }) =>
      publishImageNow(deliveryId),
    onSuccess: (_, input) => refresh(input.postId),
  });
  const cancelMutation = useMutation({
    mutationFn: ({ deliveryId }: { postId: string; deliveryId: string }) =>
      cancelImagePostDelivery(deliveryId),
    onSuccess: (_, input) => refresh(input.postId),
  });
  const reconcileMutation = useMutation({
    mutationFn: ({
      deliveryId,
      remotePostId,
    }: {
      postId: string;
      deliveryId: string;
      remotePostId?: string;
    }) => reconcileImagePostDelivery(deliveryId, remotePostId),
    onSuccess: (_, input) => refresh(input.postId),
  });

  return {
    createPlanMutation,
    renderPlanMutation,
    saveMutation,
    reviewMutation,
    scheduleMutation,
    publishMutation,
    cancelMutation,
    reconcileMutation,
  };
}
