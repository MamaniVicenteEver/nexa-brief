import type { MediaSource } from "@/shared/components/media/MediaPlayerModal";
import type { CatalogEntry } from "./types";

export function playbackSource(item: CatalogEntry): MediaSource | null {
  const playback = item.playback;
  if (playback.desktop_video_url || playback.mobile_video_url) {
    return {
      kind: "video",
      desktopUrl: playback.desktop_video_url,
      mobileUrl: playback.mobile_video_url,
    };
  }
  if (!playback.engine_url) return null;
  const [path, query = ""] = playback.engine_url.split("?");
  const params = new URLSearchParams(query);
  params.set("controls", "1");
  params.set("volume", "0.05");
  params.set("norec", "1");
  return { kind: "iframe", url: `${path}?${params}`, poster: item.poster_url };
}
