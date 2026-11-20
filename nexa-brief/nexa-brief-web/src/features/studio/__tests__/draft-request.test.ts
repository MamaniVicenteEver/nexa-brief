import { describe, expect, it } from "vitest";
import type { TemplateRequirements } from "@/features/templates/types";
import { EMPTY_STUDIO_VALUE, type Draft } from "../types";
import { buildDraftRequest, defaultStudioValue, studioValueFromDraft } from "../lib/draft-request";

const requirements = (min: number, target: "media" | "config" | "source" = "media") =>
  ({
    audio: { required: false, lyrics: "none" },
    media: [{ slot: "clips", kind: "video", min, max: 6, orientation: null, target, label: "Videos", hint: "" }],
    texts: [],
    brief: false,
    defaults: {
      audioAssetId: "song-id",
      media: { clips: [{ assetId: "clip-1", kind: "video" }] },
    },
  }) as TemplateRequirements;

describe("template Studio defaults and empty slots", () => {
  it("seeds the selected song and media from the requirements", () => {
    const value = defaultStudioValue(requirements(1));
    expect(value.musicAssetId).toBe("song-id");
    expect(value.media.clips).toEqual([{ assetId: "clip-1", kind: "video" }]);
  });

  it("sends an explicit empty array only when an optional slot was cleared", () => {
    const req = requirements(0);
    const cleared = { ...EMPTY_STUDIO_VALUE, media: { clips: [] } };
    expect(buildDraftRequest("lyrics-test", req, cleared).template_inputs?.media).toEqual({ clips: [] });
    expect(buildDraftRequest("lyrics-test", req, EMPTY_STUDIO_VALUE).template_inputs).toBeUndefined();
  });

  it("preserves an explicit removal after reopening", () => {
    const draft = { inputs: { musicAssetId: null, imageAssetId: null, videoAssetId: null,
      templateInputs: { media: { clips: [] } } } } as unknown as Draft;
    const restored = studioValueFromDraft(draft, requirements(0));
    expect(restored.media).toEqual({ clips: [] });
    expect(buildDraftRequest("lyrics-test", requirements(0), restored).template_inputs?.media).toEqual({ clips: [] });
  });

  it("does not send empty source selections or clear a required slot", () => {
    const optionalSource = requirements(0, "source");
    const clearedSource = { ...EMPTY_STUDIO_VALUE, media: { clips: [] } };
    expect(buildDraftRequest("lyrics-test", optionalSource, clearedSource).template_inputs).toBeUndefined();
    expect(buildDraftRequest("lyrics-test", requirements(1), clearedSource).template_inputs).toBeUndefined();
  });
});
