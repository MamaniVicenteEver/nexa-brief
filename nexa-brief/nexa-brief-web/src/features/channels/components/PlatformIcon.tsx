import { cn } from "@/lib/utils";
import { PLATFORM_META } from "../constants/platforms";
import type { ChannelPlatform } from "../types";

const GLYPHS: Record<ChannelPlatform, string> = {
  youtube: "M9 6.8v10.4l8.4-5.2z",
  tiktok:
    "M14.5 5.5c.4 1.6 1.6 2.8 3.2 3v2.3a5.6 5.6 0 0 1-3.2-1v4.7a4.2 4.2 0 1 1-4.2-4.2c.2 0 .5 0 .7.1v2.4a1.9 1.9 0 1 0 1.2 1.7V5.5z",
  facebook:
    "M13.2 19v-6h2l.3-2.4h-2.3V9.1c0-.7.2-1.1 1.2-1.1h1.2V5.9a16 16 0 0 0-1.8-.1c-1.8 0-3 1.1-3 3.1v1.7H8.8V13h2V19z",
  instagram: "",
};

/** Brand-colored rounded tile with the platform glyph. */
export function PlatformIcon({
  platform,
  className,
  rounded = "rounded-[10px]",
}: {
  platform: ChannelPlatform;
  className?: string;
  rounded?: string;
}) {
  const meta = PLATFORM_META[platform] ?? { color: "#737373" };
  const glyph = GLYPHS[platform];

  return (
    <span
      aria-hidden
      className={cn("inline-grid size-9 shrink-0 place-items-center", rounded, className)}
      style={{ backgroundColor: meta.color }}
    >
      <svg viewBox="0 0 24 24" className="size-[62%]" aria-hidden="true">
        {platform === "instagram" ? (
          <>
            <rect
              x="3.5"
              y="3.5"
              width="17"
              height="17"
              rx="5"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
            />
            <circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="2" />
            <circle cx="17.6" cy="6.7" r="1.2" fill="#fff" />
          </>
        ) : glyph ? (
          <path fill="#fff" d={glyph} />
        ) : (
          <circle cx="12" cy="12" r="4" fill="#fff" />
        )}
      </svg>
    </span>
  );
}
