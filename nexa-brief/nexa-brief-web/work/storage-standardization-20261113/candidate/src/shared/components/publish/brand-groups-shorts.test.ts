import { describe, expect, it } from "vitest";
import { allowedFormatsFor, formatFor, youtubeFormatHint } from "./brand-groups";

describe("YouTube vertical publishing", () => {
  const youtube = { selector: "youtube:test", label: "YouTube", platform: "youtube", group: "test" };

  it("allows the recorded vertical format for YouTube and keeps the horizontal default", () => {
    expect(allowedFormatsFor("youtube", ["9x16"])).toEqual(["9x16"]);
    expect(formatFor(youtube, ["9x16"], {})).toBe("9x16");
    expect(formatFor(youtube, ["16x9", "9x16"], {})).toBe("16x9");
    expect(formatFor(youtube, ["16x9", "9x16"], {}, "9x16")).toBe("9x16");
    expect(formatFor(youtube, ["16x9", "9x16"], { "youtube:test": "16x9" }, "9x16")).toBe("16x9");
    expect(formatFor(youtube, ["16x9", "9x16"], { "youtube:test": "9x16" })).toBe("9x16");
  });

  it("explains Shorts eligibility at the three minute boundary", () => {
    expect(youtubeFormatHint("9x16", 180)).toBe("youtubeShortEligible");
    expect(youtubeFormatHint("9x16", 180.01)).toBe("youtubeShortLong");
    expect(youtubeFormatHint("9x16", null)).toBe("youtubeShortUnknown");
    expect(youtubeFormatHint("9x16", 0)).toBe("youtubeShortUnknown");
    expect(youtubeFormatHint("16x9", 40)).toBe("youtubeHorizontal");
    expect(youtubeFormatHint(null, 40)).toBeNull();
  });
});
