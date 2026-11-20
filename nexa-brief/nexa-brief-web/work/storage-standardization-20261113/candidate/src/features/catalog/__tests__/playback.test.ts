import { describe, expect, it } from "vitest";
import { playbackSource } from "../playback";
import type { CatalogEntry } from "../types";

const item: CatalogEntry = {
  id: "demo:ink",
  source_id: "ink",
  kind: "demo",
  title: "Ink",
  category_ids: ["history"],
  poster_url: "/poster.jpg",
  orientation: "any",
  demo: true,
  design_id: "ink",
  playback: {
    engine_url: "/engine?existing=1",
    engine: "explainer",
    desktop_video_url: null,
    mobile_video_url: null,
  },
};

describe("catalogue playback contract", () => {
  it("uses the interactive engine with playback-only controls when no movie exists", () => {
    const source = playbackSource(item);
    expect(source?.kind).toBe("iframe");
    if (source?.kind !== "iframe") throw new Error("Expected engine");
    const url = new URL(source.url, "http://test");
    expect(url.searchParams.get("existing")).toBe("1");
    expect(url.searchParams.get("norec")).toBe("1");
    expect(source.poster).toBe("/poster.jpg");
  });
  it("prefers the complete MP4 and keeps desktop and portrait files distinct", () => {
    expect(
      playbackSource({
        ...item,
        playback: {
          ...item.playback,
          desktop_video_url: "/full.mp4",
          mobile_video_url: "/portrait.mp4",
        },
      }),
    ).toEqual({
      kind: "video",
      desktopUrl: "/full.mp4",
      mobileUrl: "/portrait.mp4",
    });
  });
  it("supports a portrait-only MP4 and reports unavailable content", () => {
    expect(
      playbackSource({ ...item, playback: { ...item.playback, mobile_video_url: "/portrait.mp4" } })
        ?.kind,
    ).toBe("video");
    expect(
      playbackSource({ ...item, playback: { ...item.playback, engine_url: null } }),
    ).toBeNull();
  });
});
