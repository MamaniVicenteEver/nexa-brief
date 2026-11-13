import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { mapJob, mapPublishPackage, mapThumbnails } from "../api/explainer-service";
import type { Localization } from "../hooks/useLocalizations";
import type { ExplainerVideo } from "../types";

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) => (typeof value === "string" ? value : "");
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** Keep technical identity while replacing every editorial field with this edition's data. */
export function studioVideo(video: ExplainerVideo, edition?: Localization): ExplainerVideo {
  if (!edition || edition.is_original) return video;
  const publish = edition.publish ?? {};
  const youtube = object(publish.youtube),
    instagram = object(publish.instagram);
  const facebook = object(publish.facebook),
    tiktok = object(publish.tiktok);
  return {
    ...video,
    title: text(youtube.title),
    topic: "",
    scriptText: "",
    scriptReviewRequired: false,
    ready: edition.studio?.ready ?? Boolean(edition.preview_url),
    publishReady:
      edition.studio?.publish_ready ??
      (edition.status === "ready" && !edition.stale && edition.studio?.issues.length === 0),
    previewUrl: edition.preview_url ? resolveApiUrl(edition.preview_url) : "",
    posterUrl: null,
    lastJob: edition.studio?.last_job ? mapJob(edition.studio.last_job) : null,
    rendered: [],
    youtubeTitle: text(youtube.title),
    youtubeDescription: text(youtube.description),
    youtubeTags: strings(youtube.tags),
    instagramTitle: text(instagram.title),
    instagramDescription: text(instagram.description),
    facebookTitle: text(facebook.title),
    facebookDescription: text(facebook.description),
    tiktokCaption: text(tiktok.caption),
    tiktokHashtags: strings(tiktok.hashtags),
    demo: false,
    demoSummary: "",
    reviewRequirements: [],
    estimatedTokens: null,
    durationSeconds: edition.studio?.duration_seconds ?? null,
    qualityIssues: [],
    publishPackage: edition.studio?.publish_package
      ? mapPublishPackage(edition.studio.publish_package)
      : null,
    thumbnails: mapThumbnails(edition.studio?.thumbnails),
  };
}

export function editionYoutube(edition: Localization) {
  return object(edition.publish?.youtube);
}
