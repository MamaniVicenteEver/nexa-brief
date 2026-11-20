import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseDraftThumbnail, mapDraft } from "../api/studio-service";
import { httpClient } from "@/infrastructure/api/http-client";

vi.mock("@/infrastructure/api/http-client", () => ({
  httpClient: vi.fn(),
  resolveApiUrl: (url: string) => `resolved:${url}`,
}));

const manifest = {
  fingerprint: "abc",
  selected: "A" as const,
  urls: { A: "/api/v1/drafts/draft/thumbnails/A" },
  options: { A: { text: "A" }, B: { text: "B" } },
};
const dto = {
  draft_id: "draft",
  template_id: "lyrics-caution",
  status: "prepared" as const,
  stage: "html_generated",
  errors: [],
  inputs: {},
  preview_url: null,
  job_id: null,
  recoverable: false,
  thumbnails: manifest,
  thumbnails_by_output: { youtube_shorts: { ...manifest, selected: "B" } },
  created_at: "now",
  updated_at: "now",
};

afterEach(() => vi.clearAllMocks());

describe("una sola miniatura A/B para todos los destinos", () => {
  it("ignores per-destination manifests and keeps the shared one", () => {
    const draft = mapDraft(dto as never);
    expect(draft.thumbnails?.selected).toBe("A");
    expect(draft.thumbnails?.urls.A).toBe(`resolved:${manifest.urls.A}`);
    expect("thumbnailsByOutput" in draft).toBe(false);
  });

  it("selects without any destination query", async () => {
    vi.mocked(httpClient).mockResolvedValue(dto as never);
    await chooseDraftThumbnail("draft", "B");
    expect(httpClient).toHaveBeenLastCalledWith("/api/v1/drafts/draft/thumbnails", {
      method: "PUT",
      body: { option: "B" },
    });
  });
});
