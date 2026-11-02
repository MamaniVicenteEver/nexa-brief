import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureThumbnails } from "../api/explainer-service";
import { EXPLAINER_VIDEOS_QUERY_KEY, usePrepareThumbnails } from "../hooks/useExplainer";
import type { ExplainerVideo } from "../types";

vi.mock("../api/explainer-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/explainer-service")>()),
  captureThumbnails: vi.fn(),
}));

const video = {
  videoId: "demo",
  ready: true,
  thumbnails: {
    chosen: "C",
    options: [
      { option: "C", component: "common.tabloid", params: { src: "/cover.png" }, url: null },
    ],
  },
} as unknown as ExplainerVideo;
const captured = {
  ...video.thumbnails,
  options: [{ ...video.thumbnails.options[0], url: "/thumbnail-C.jpg" }],
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData([...EXPLAINER_VIDEOS_QUERY_KEY, "node_tech"], [video]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

afterEach(() => vi.clearAllMocks());

describe("thumbnail preparation", () => {
  it("prepares missing captures automatically and refreshes the video's displayed thumbnails", async () => {
    vi.mocked(captureThumbnails).mockResolvedValue(captured);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => usePrepareThumbnails(video), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(captureThumbnails).toHaveBeenCalledExactlyOnceWith("demo", true);
    expect(
      client.getQueryData<ExplainerVideo[]>([...EXPLAINER_VIDEOS_QUERY_KEY, "node_tech"])?.[0]
        .thumbnails,
    ).toEqual(captured);
    client.clear();
  });
  it("does not capture videos that already have previews or are not ready", async () => {
    const { client, wrapper } = setup();
    renderHook(() => usePrepareThumbnails({ ...video, thumbnails: captured }), { wrapper });
    renderHook(() => usePrepareThumbnails({ ...video, videoId: "in-progress", ready: false }), {
      wrapper,
    });
    expect(captureThumbnails).not.toHaveBeenCalled();
    client.clear();
  });
  it("reports preparation failure without an automatic retry loop", async () => {
    vi.mocked(captureThumbnails).mockRejectedValue(new Error("Image unavailable"));
    const { client, wrapper } = setup();
    const { result, rerender } = renderHook(() => usePrepareThumbnails(video), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    rerender();
    expect(captureThumbnails).toHaveBeenCalledTimes(1);
    expect(result.current.error?.message).toBe("Image unavailable");
    client.clear();
  });
});
