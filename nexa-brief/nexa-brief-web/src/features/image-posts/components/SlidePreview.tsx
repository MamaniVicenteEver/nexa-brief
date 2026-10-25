import { ImageIcon, Music2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ImageSlide, Platform } from "../types";

export function SlidePreview({
  slide,
  title,
  strategyName = null,
  caption,
  platform,
  index,
  total,
  reel = false,
  demo = false,
}: {
  slide: ImageSlide | null;
  title: string;
  strategyName?: string | null;
  caption: string;
  platform: Platform;
  index: number;
  total: number;
  reel?: boolean;
  demo?: boolean;
}) {
  const t = useTranslations("imagePosts.editor");
  const alt = platform === "facebook" ? slide?.altTextFacebook : slide?.altTextInstagram;

  return (
    <div
      className={`relative mx-auto w-full overflow-hidden rounded-[22px] border border-white/15 bg-[#171b23] text-white shadow-2xl ${reel ? "aspect-[9/16] max-w-[280px]" : "aspect-[4/5] max-w-[390px]"}`}
    >
      {strategyName && (
        <span className="absolute top-2 left-2 z-20 max-w-[75%] truncate rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-semibold text-white shadow">
          {strategyName}
        </span>
      )}
      {slide?.previewUrl ? (
        // Preview URLs are returned by the authenticated API; paths are never derived from storage keys.
        // biome-ignore lint/performance/noImgElement: preview may be a short-lived signed API URL.
        <img src={slide.previewUrl} alt={alt || title} className="size-full object-contain" />
      ) : (
        <div className="relative flex size-full flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_80%_12%,rgba(239,180,61,0.28),transparent_34%),linear-gradient(145deg,#222a39,#101319_72%)] p-6 sm:p-8">
          <div
            aria-hidden
            className="absolute -right-12 -bottom-10 size-48 rounded-full border border-white/10"
          />
          <div
            aria-hidden
            className="absolute right-5 bottom-6 size-28 rounded-full border border-[#e6b94f]/40"
          />
          <div className="relative z-10 flex items-center justify-between gap-3 text-[10px] font-bold tracking-[0.18em] text-white/65 uppercase">
            <span>NEXA BRIEF</span>
            <span>
              {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </div>
          <div className="relative z-10 my-auto flex flex-col gap-4 py-8">
            {reel && <Music2 className="size-5 text-[#e6b94f]" aria-hidden />}
            <h3 className="max-w-[18ch] text-balance text-[clamp(1.6rem,4vw,2.8rem)] leading-[1.04] font-extrabold tracking-[-0.04em]">
              {title || (reel ? t("reelTitle") : t("slideTitle", { number: index + 1 }))}
            </h3>
            <p className="line-clamp-5 max-w-[34ch] text-pretty text-[13px] leading-relaxed text-white/75">
              {caption || (reel ? t("reelPreview") : t("chooseVideoHint"))}
            </p>
          </div>
          <div className="relative z-10 flex items-center justify-between border-t border-white/15 pt-3 text-[10px] font-semibold text-white/55">
            <span>{reel ? "FORMATO REEL · 9:16" : "PUBLICACIÓN · 4:5"}</span>
            {demo ? <span>DEMO</span> : <ImageIcon className="size-4" aria-hidden />}
          </div>
        </div>
      )}
      {(demo || !slide?.previewUrl) && (
        <span className="absolute right-2 bottom-2 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-semibold text-white/85">
          {demo ? t("demoBadge") : t("notValidatedBadge")}
        </span>
      )}
    </div>
  );
}
