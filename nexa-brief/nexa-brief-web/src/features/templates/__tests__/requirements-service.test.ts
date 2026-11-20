import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/infrastructure/api/api-error";
import { httpClient } from "@/infrastructure/api/http-client";
import { getTemplateRequirements } from "../api/templates-service";

vi.mock("@/infrastructure/api/http-client", () => ({
  httpClient: vi.fn(),
  resolveApiUrl: (path: string) => path,
}));

const response = {
  audio: { required: true, lyrics: "auto" as const },
  media: [],
  texts: [],
  brief: true,
  defaults: {
    audio_asset_id: "profile-song",
    media: { clips: [{ asset_id: "profile-clip", kind: "video" as const }] },
  },
};

describe("template requirements preparation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the explicit POST and maps the active profile IDs", async () => {
    vi.mocked(httpClient).mockResolvedValue(response as never);
    const requirements = await getTemplateRequirements("lyrics-hologram");
    expect(httpClient).toHaveBeenCalledWith(
      "/api/v1/templates/lyrics-hologram/requirements",
      { method: "POST", signal: undefined },
    );
    expect(requirements.defaults).toEqual({
      audioAssetId: "profile-song",
      media: { clips: [{ assetId: "profile-clip", kind: "video" }] },
    });
  });

  it("falls back to the read-only GET on servers that do not expose the POST yet", async () => {
    vi.mocked(httpClient)
      .mockRejectedValueOnce(new ApiError(405, "Method Not Allowed"))
      .mockResolvedValueOnce(response as never);
    await getTemplateRequirements("lyrics-hologram");
    expect(httpClient).toHaveBeenNthCalledWith(
      1,
      "/api/v1/templates/lyrics-hologram/requirements",
      { method: "POST", signal: undefined },
    );
    expect(httpClient).toHaveBeenNthCalledWith(
      2,
      "/api/v1/templates/lyrics-hologram/requirements",
      { signal: undefined },
    );
  });
});
