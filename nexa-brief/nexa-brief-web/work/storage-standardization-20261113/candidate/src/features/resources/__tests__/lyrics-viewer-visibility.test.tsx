import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LyricsViewer } from "../components/LyricsViewer";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../hooks/useResources", () => ({ useLyrics: () => ({ data: undefined }) }));
vi.mock("@/features/library/api/library-assets-service", () => ({
  resolveAssetFileUrl: () => "/audio.mp3",
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("lyrics viewer visibility", () => {
  it("pauses its own audio on collapse without losing the current position", () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const { container, rerender } = render(<LyricsViewer assetId="song" />);
    const audio = container.querySelector("audio") as HTMLAudioElement;
    audio.currentTime = 17;
    rerender(<LyricsViewer assetId="song" visible={false} />);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(17);
    rerender(<LyricsViewer assetId="song" visible />);
    expect(container.querySelector("audio")).toBe(audio);
    expect(audio.currentTime).toBe(17);
    expect(pause).toHaveBeenCalledTimes(1);
  });
  it("does not pause a shared external audio element on collapse", () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const audioRef = { current: document.createElement("audio") };
    const { rerender } = render(<LyricsViewer assetId="song" audioRef={audioRef} />);
    rerender(<LyricsViewer assetId="song" audioRef={audioRef} visible={false} />);
    expect(pause).not.toHaveBeenCalled();
  });
});
