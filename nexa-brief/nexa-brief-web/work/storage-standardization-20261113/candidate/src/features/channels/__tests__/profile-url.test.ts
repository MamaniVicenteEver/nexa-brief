import { describe, expect, it } from "vitest";
import { getChannelProfileUrl } from "../lib/profile-url";
import type { ChannelPlatform } from "../types";

const profile = (platform: ChannelPlatform, fields = {}) => ({
  platform,
  targetId: "",
  handle: null,
  customUrl: null,
  ...fields,
});

describe("public channel links", () => {
  it("uses the stable YouTube channel ID rather than an internal alias", () => {
    expect(getChannelProfileUrl(profile("youtube", { targetId: "UCwi_UWds88cEsNRnLgoCz1w" }))).toBe(
      "https://www.youtube.com/channel/UCwi_UWds88cEsNRnLgoCz1w",
    );
  });
  it("supports public and relative YouTube handles", () => {
    expect(getChannelProfileUrl(profile("youtube", { customUrl: "@nodemotiondc" }))).toBe(
      "https://www.youtube.com/@nodemotiondc",
    );
    expect(getChannelProfileUrl(profile("youtube", { handle: "@tecnología" }))).toBe(
      "https://www.youtube.com/@tecnolog%C3%ADa",
    );
  });
  it("opens Facebook using its Page ID", () => {
    expect(getChannelProfileUrl(profile("facebook", { targetId: "1402041146323548" }))).toBe(
      "https://www.facebook.com/1402041146323548",
    );
  });
  it("uses Instagram usernames and an existing public URL", () => {
    expect(getChannelProfileUrl(profile("instagram", { handle: "nodetech_es" }))).toBe(
      "https://www.instagram.com/nodetech_es",
    );
    expect(
      getChannelProfileUrl(
        profile("instagram", { customUrl: "https://www.instagram.com/nodetech_es" }),
      ),
    ).toBe("https://www.instagram.com/nodetech_es");
  });
  it("uses TikTok's public handle, never its opaque OAuth ID", () => {
    expect(
      getChannelProfileUrl(
        profile("tiktok", { targetId: "opaqueOAuthID", handle: "drova.studio" }),
      ),
    ).toBe("https://www.tiktok.com/@drova.studio");
    expect(getChannelProfileUrl(profile("tiktok", { targetId: "opaqueOAuthID" }))).toBeNull();
  });
  it.each([
    "javascript:alert(1)",
    "https://www.instagram.com.evil.test/name",
    "https://instagram.com@evil.test/name",
    "https://user:pass@instagram.com/name",
    "http://instagram.com/name",
    "https://instagram.com:8443/name",
    "https://instagram.com/",
  ])("does not open an untrusted custom URL: %s", (customUrl) => {
    expect(getChannelProfileUrl(profile("instagram", { customUrl }))).toBeNull();
  });
  it("does not construct a profile from malformed handles or missing metadata", () => {
    expect(getChannelProfileUrl(profile("instagram", { handle: "name/path?query" }))).toBeNull();
    expect(getChannelProfileUrl(profile("youtube"))).toBeNull();
    expect(getChannelProfileUrl(profile("facebook"))).toBeNull();
  });
});
