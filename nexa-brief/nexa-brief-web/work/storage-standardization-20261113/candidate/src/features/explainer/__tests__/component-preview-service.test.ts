import { expect, it, vi } from "vitest";
import { requestComponentPreviews } from "../api/component-preview-service";

const http = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/api/http-client", () => ({
  httpClient: http,
  resolveApiUrl: (url: string) => `https://api.test${url}`,
}));

it("conserva el pedido del kit y agrega los campos de sandbox", async () => {
  http.mockResolvedValue({
    previews: [
      {
        key: "s",
        video_id: "atlas",
        design: "",
        component: "atlas.outro",
        preview_url: "/preview",
      },
    ],
  });
  const result = await requestComponentPreviews([
    { key: "k", videoId: "video", component: "kit.outro", params: {} },
    {
      key: "s",
      videoId: "atlas",
      component: "atlas.outro",
      scope: "sandbox",
      components: [],
      params: {},
    },
  ]);
  expect(http.mock.calls[0][1].body.previews).toEqual([
    {
      key: "k",
      video_id: "video",
      component: "kit.outro",
      params: {},
      time_seconds: 3,
      duration_seconds: 6,
    },
    {
      key: "s",
      video_id: "atlas",
      component: "atlas.outro",
      scope: "sandbox",
      components: [],
      params: {},
      time_seconds: 3,
      duration_seconds: 6,
    },
  ]);
  expect(result[0].previewUrl).toBe("https://api.test/preview");
});
