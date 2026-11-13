import type { ChannelPlatform } from "@/features/channels/types";
import type { PublicChannel } from "@/features/stats";
import { publicChannelPlatform } from "@/features/stats/public-channel";

const PLATFORM_CLASS: Record<ChannelPlatform, string> = {
  youtube: "nb-chan-icon-yt",
  tiktok: "nb-chan-icon-tt",
  facebook: "nb-chan-icon-fb",
  instagram: "nb-chan-icon-ig",
};

const PLATFORM_SHORT: Record<ChannelPlatform, string> = {
  youtube: "YT",
  tiktok: "TT",
  facebook: "FB",
  instagram: "IG",
};

/** Insignias públicas: la plataforma se deduce de la URL, sin datos de cuentas. */
export function ChannelAvatarStack({
  channels,
  max = 4,
}: {
  channels: PublicChannel[];
  max?: number;
}) {
  const shown = channels.slice(0, max);
  const rest = channels.length - shown.length;
  return (
    <div className="flex">
      {shown.map((channel) => {
        const platform = publicChannelPlatform(channel.publicUrl);
        return (
          <span
            key={`${channel.publicUrl ?? "unlinked"}:${channel.name}`}
            title={channel.name}
            className={`nb-chan-icon overflow-hidden ${platform ? PLATFORM_CLASS[platform] : "bg-nb-ink"}`}
          >
            {platform ? PLATFORM_SHORT[platform] : channel.name.slice(0, 1)}
          </span>
        );
      })}
      {rest > 0 && <span className="nb-chan-icon bg-nb-ink text-[11px]">+{rest}</span>}
    </div>
  );
}
