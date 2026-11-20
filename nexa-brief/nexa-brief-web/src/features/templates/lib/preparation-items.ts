import { ACTIVE_JOB_STATES, type ExplainerVideo } from "@/features/explainer/types";
import type { ImagePost } from "@/features/image-posts/types";

export function isPreparedVideo(video: ExplainerVideo): boolean {
  if (video.status === "en preparación") return true;
  if (video.scriptReviewRequired)
    return !(video.lastJob && ACTIVE_JOB_STATES.includes(video.lastJob.state));
  return (
    (video.ready || (video.design === "mapas-satelitales" && video.status === "en progreso")) &&
    video.rendered.length === 0 &&
    !(video.lastJob && ACTIVE_JOB_STATES.includes(video.lastJob.state))
  );
}

export function isReviewDemo(video: ExplainerVideo): boolean {
  return video.demo && video.status.trim().toLocaleLowerCase() === "lista para revisar";
}

export function isRenderedVideo(video: ExplainerVideo): boolean {
  return !video.scriptReviewRequired && video.rendered.length > 0;
}

export function isRenderedImage(post: ImagePost): boolean {
  return (
    ["rendered", "ready_for_review", "approved", "scheduled", "completed", "partial"].includes(
      post.status,
    ) || post.slides.some((slide) => Boolean(slide.previewUrl))
  );
}
