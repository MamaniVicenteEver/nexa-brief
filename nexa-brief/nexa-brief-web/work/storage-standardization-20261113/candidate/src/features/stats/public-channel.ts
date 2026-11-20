import type { ChannelPlatform } from "@/features/channels/types";

/** Solo usa la URL pública; la landing no necesita metadatos de la cuenta. */
export function publicChannelPlatform(publicUrl: string | null): ChannelPlatform | null {
  if (!publicUrl) return null;
  try {
    const hostname = new URL(publicUrl).hostname.replace(/^www\./, "");
    const platforms: Record<string, ChannelPlatform> = {
      "youtube.com": "youtube",
      "facebook.com": "facebook",
      "instagram.com": "instagram",
      "tiktok.com": "tiktok",
    };
    return platforms[hostname] ?? null;
  } catch {
    return null;
  }
}
