import type { PublicChannel } from "@/features/stats";

const PLATFORM_CLASS: Record<PublicChannel["platform"], string> = {
  youtube: "nb-chan-icon-yt",
  tiktok: "nb-chan-icon-tt",
  facebook: "nb-chan-icon-fb",
  instagram: "nb-chan-icon-ig",
};

const PLATFORM_SHORT: Record<PublicChannel["platform"], string> = {
  youtube: "YT",
  tiktok: "TT",
  facebook: "FB",
  instagram: "IG",
};

/** Avatares superpuestos de los canales reales. Sin avatar (TikTok/Facebook no
 * siempre lo devuelven) cae al círculo de color de la plataforma. */
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
      {shown.map((channel) => (
        <span
          key={channel.id}
          title={channel.name}
          className={`nb-chan-icon overflow-hidden ${PLATFORM_CLASS[channel.platform]}`}
        >
          {channel.avatar ? (
            // biome-ignore lint/performance/noImgElement: avatar remoto de la plataforma, no un asset de Next
            <img
              src={channel.avatar}
              alt=""
              className="size-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            PLATFORM_SHORT[channel.platform]
          )}
        </span>
      ))}
      {rest > 0 && <span className="nb-chan-icon bg-nb-ink text-[11px]">+{rest}</span>}
    </div>
  );
}
