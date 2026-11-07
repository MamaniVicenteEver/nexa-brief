import type { ChannelAccount } from "../types";

type PublicProfile = Pick<ChannelAccount, "platform" | "targetId" | "handle" | "customUrl">;

/** Internal aliases and TikTok OAuth open IDs aren't public usernames. */
export function getChannelProfileUrl(account: PublicProfile): string | null {
  const domain = {
    youtube: "youtube.com",
    facebook: "facebook.com",
    instagram: "instagram.com",
    tiktok: "tiktok.com",
  }[account.platform];
  const targetId = account.targetId.trim();
  if (account.platform === "youtube" && /^UC[\w-]{22}$/.test(targetId)) {
    return `https://www.youtube.com/channel/${targetId}`;
  }
  if (account.customUrl) {
    try {
      const url = new URL(account.customUrl);
      if (
        url.protocol === "https:" &&
        [domain, `www.${domain}`].includes(url.hostname) &&
        !url.username &&
        !url.password &&
        !url.port &&
        url.pathname !== "/"
      ) {
        url.hash = "";
        return url.toString();
      }
    } catch {
      // YouTube also returns a relative @handle in custom_url.
    }
  }
  if (account.platform === "facebook" && /^\d+$/.test(targetId)) {
    return `https://www.facebook.com/${targetId}`;
  }
  const handle = (
    account.handle ||
    (account.customUrl?.startsWith("@") ? account.customUrl : "") ||
    ""
  )
    .trim()
    .replace(/^@/, "");
  if (!/^[\p{L}\p{N}._-]+$/u.test(handle)) return null;
  const prefix = account.platform === "youtube" || account.platform === "tiktok" ? "@" : "";
  return `https://www.${domain}/${prefix}${encodeURIComponent(handle)}`;
}
