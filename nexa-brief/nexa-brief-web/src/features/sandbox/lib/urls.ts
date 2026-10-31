import type { MediaSource } from "@/shared/components/media/MediaPlayerModal";
import type { SandboxItem } from "../types";

type SandboxItemPlayback = SandboxItem & {
  player?: "protocol" | "video" | "none";
  thumbnailUrl?: string | null;
};

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function sandboxFileUrl(path: string, file: string): string {
  return `/api/v1/explainer/files/${encodePath(path)}/${encodePath(file)}`;
}

function setQueryParameter(url: string, key: string, value: string): string {
  const hashIndex = url.indexOf("#");
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = withoutHash.indexOf("?");
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(query);
  params.set(key, value);
  return `${pathname}?${params.toString()}${hash}`;
}

export function sandboxIframeUrl(path: string): string {
  return setQueryParameter(sandboxFileUrl(path, "index.html"), "controls", "1");
}

export function previewTarget(item: SandboxItem): MediaSource | null {
  const playableItem = item as SandboxItemPlayback;
  const player =
    playableItem.player ?? (item.hasIndex ? "protocol" : item.videos.length > 0 ? "video" : "none");

  if (player === "protocol" && item.hasIndex) {
    const poster =
      playableItem.thumbnailUrl ??
      (item.hasPoster ? sandboxFileUrl(item.path, "render/poster.jpg") : null);
    return { kind: "iframe", url: sandboxIframeUrl(item.path), poster };
  }

  const video = item.videos[0];
  if (player === "video" && video) {
    return {
      kind: "video",
      desktopUrl: sandboxFileUrl(item.path, video),
      mobileUrl: null,
    };
  }

  return null;
}
