import { ACTIVE_JOB_STATES, type ExplainerVideo } from "@/features/explainer/types";
import type { ImagePost } from "@/features/image-posts/types";

export function isPreparedVideo(video: ExplainerVideo): boolean {
  return (
    video.ready &&
    video.rendered.length === 0 &&
    !(video.lastJob && ACTIVE_JOB_STATES.includes(video.lastJob.state))
  );
}

export function isRenderedVideo(video: ExplainerVideo): boolean {
  return video.rendered.length > 0;
}

export function isRenderedImage(post: ImagePost): boolean {
  return (
    ["rendered", "ready_for_review", "approved", "scheduled", "completed", "partial"].includes(
      post.status,
    ) || post.slides.some((slide) => Boolean(slide.previewUrl))
  );
}
