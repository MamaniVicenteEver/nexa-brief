import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LibraryAsset } from "@/features/library/api/library-assets-service";
import { usePrototypeSongDurations } from "../hooks/usePrototypeSongDurations";
import type { Draft } from "../types";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/features/library/api/library-assets-service", () => ({
  getLibraryAsset: api.get,
  resolveAssetFileUrl: (_kind: string, id: string) => `/audio/${id}`,
}));

const draft = (id: string) => ({ inputs: { musicAssetId: id } }) as Draft;
const song = (id: string, duration: number | null) =>
  ({ assetId: id, durationSeconds: duration }) as LibraryAsset;
function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  api.get.mockReset();
});

describe("prototype song durations", () => {
  it("uses known durations and fetches only songs missing from the scoped list", async () => {
    api.get.mockResolvedValue(song("demo", 178));
    const { result } = renderHook(
      () => usePrototypeSongDurations([draft("known"), draft("demo")], [song("known", 170)], false),
      { wrapper: wrapper() },
    );
    expect(result.current.known).toBe(170);
    await waitFor(() => expect(result.current.demo).toBe(178));
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith("music", "demo", expect.any(AbortSignal));
  });

  it("limits missing-song lookups to three concurrent requests", async () => {
    let active = 0;
    let peak = 0;
    const release: (() => void)[] = [];
    api.get.mockImplementation(async (_kind: string, id: string) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => release.push(resolve));
      active -= 1;
      return song(id, 60);
    });
    const drafts = ["a", "b", "c", "d", "e"].map(draft);
    const { result } = renderHook(() => usePrototypeSongDurations(drafts, [], false), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(release).toHaveLength(3));
    await act(async () => {
      release.splice(0, 3).forEach((resolve) => {
        resolve();
      });
    });
    await waitFor(() => expect(release).toHaveLength(2));
    await act(async () => {
      release.splice(0).forEach((resolve) => {
        resolve();
      });
    });
    await waitFor(() => expect(result.current.e).toBe(60));
    expect(peak).toBe(3);
  });

  it("reads unknown durations with at most two audio elements, and cleans up on unmount", async () => {
    const audios: FakeAudio[] = [];
    class FakeAudio extends EventTarget {
      preload = "";
      src = "";
      duration = 0;
      load = vi.fn();
      removeAttribute = vi.fn(() => {
        this.src = "";
      });
      constructor() {
        super();
        audios.push(this);
      }
    }
    vi.stubGlobal("Audio", FakeAudio);
    const drafts = [draft("one"), draft("two"), draft("three")];
    const songs = [song("one", null), song("two", null), song("three", null)];
    const { result, unmount } = renderHook(() => usePrototypeSongDurations(drafts, songs, false), {
      wrapper: wrapper(),
    });
    expect(audios).toHaveLength(2);
    act(() => {
      audios[0].duration = 125;
      audios[0].dispatchEvent(new Event("loadedmetadata"));
    });
    await waitFor(() => expect(result.current.one).toBe(125));
    expect(audios).toHaveLength(3);
    expect(audios[0].src).toBe("");
    unmount();
    expect(audios[1].src).toBe("");
    expect(audios[2].src).toBe("");
  });

  it("omits an invalid duration when loading the audio fails", () => {
    class FakeAudio extends EventTarget {
      preload = "";
      src = "";
      duration = Number.NaN;
      load() {}
      removeAttribute() {
        this.src = "";
      }
      constructor() {
        super();
        instances.push(this);
      }
    }
    const instances: FakeAudio[] = [];
    vi.stubGlobal("Audio", FakeAudio);
    const { result } = renderHook(
      () => usePrototypeSongDurations([draft("missing")], [song("missing", null)], false),
      { wrapper: wrapper() },
    );
    act(() => instances[0].dispatchEvent(new Event("error")));
    expect(result.current.missing).toBeUndefined();
  });
});
