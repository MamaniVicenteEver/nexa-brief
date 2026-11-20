import { PLATFORM_META, PLATFORMS } from "../constants/platforms";
import type { ChannelAccount, ChannelPlatform } from "../types";

export function groupByPlatform(
  channels: ChannelAccount[],
): Record<ChannelPlatform, ChannelAccount[]> {
  const groups = Object.fromEntries(PLATFORMS.map((p) => [p, [] as ChannelAccount[]])) as Record<
    ChannelPlatform,
    ChannelAccount[]
  >;
  for (const channel of channels) groups[channel.platform]?.push(channel);
  for (const platform of PLATFORMS) {
    groups[platform].sort(
      (a, b) =>
        Number(b.status === "requires_reauth") - Number(a.status === "requires_reauth") ||
        a.alias.localeCompare(b.alias, undefined, { numeric: true }),
    );
  }
  return groups;
}

export function nextSuggestedAlias(platform: ChannelPlatform, existingAliases: string[]): string {
  const base = PLATFORM_META[platform].aliasBase;
  let n = 1;
  while (existingAliases.includes(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

export function matchesQuery(account: ChannelAccount, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [account.name, account.alias, account.label, account.notes, account.targetId].some(
    (field) => field?.toLowerCase().includes(q),
  );
}

export function accountKey(account: Pick<ChannelAccount, "platform" | "alias">): string {
  return `${account.platform}:${account.alias}`;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "hace 3 días" / "3 days ago" from unix seconds. */
export function formatRelativeTime(unixSeconds: number, locale: string): string {
  const diff = unixSeconds - Date.now() / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  }
  return rtf.format(0, "minute");
}

export function formatDate(unixSeconds: number, locale: string): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export type ExpiryState =
  | { kind: "never" }
  | { kind: "expired" }
  | { kind: "renews" }
  | { kind: "minutes" | "hours" | "days"; value: number };

/** An expired access token with a refresh token isn't a problem: it's renewed on the next publish. */
export function getExpiryState(
  expiresInSeconds: number | null,
  hasRefreshToken: boolean,
): ExpiryState {
  if (expiresInSeconds === null) return { kind: "never" };
  if (expiresInSeconds <= 0) return { kind: hasRefreshToken ? "renews" : "expired" };
  const hours = expiresInSeconds / 3600;
  if (hours < 1) return { kind: "minutes", value: Math.max(1, Math.round(expiresInSeconds / 60)) };
  if (hours < 48) return { kind: "hours", value: Math.round(hours) };
  return { kind: "days", value: Math.round(hours / 24) };
}
