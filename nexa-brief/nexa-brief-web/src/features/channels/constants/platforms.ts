import type { ChannelPlatform } from "../types";

export const PLATFORMS: readonly ChannelPlatform[] = ["youtube", "tiktok", "facebook"];

interface PlatformMeta {
  label: string;
  /** Brand color used for the icon tile and accents. */
  color: string;
  /** Prefix for auto-suggested aliases: canal_1, cuenta_2… */
  aliasBase: string;
}

export const PLATFORM_META: Record<ChannelPlatform, PlatformMeta> = {
  youtube: { label: "YouTube", color: "#FF0033", aliasBase: "canal" },
  tiktok: { label: "TikTok", color: "#111111", aliasBase: "cuenta" },
  facebook: { label: "Facebook", color: "#1877F2", aliasBase: "pagina" },
};

/** Same charset the backend accepts in `platform:alias` selectors. */
export const ALIAS_PATTERN = /^[a-z0-9_-]{1,32}$/;

export const LABEL_MAX_LENGTH = 60;
export const NOTES_MAX_LENGTH = 500;
