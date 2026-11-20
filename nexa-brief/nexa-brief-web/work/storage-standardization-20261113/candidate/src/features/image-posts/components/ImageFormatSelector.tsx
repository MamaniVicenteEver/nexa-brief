"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { IMAGE_FORMATS, type ImageFormat, imageFormatProfile } from "../image-formats";

export function ImageFormatSelector({
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  value: ImageFormat;
  onChange: (format: ImageFormat) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("imagePosts.formats");
  const profile = imageFormatProfile(value);
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend
        className={cn(
          "text-[10px] font-bold tracking-[0.12em] text-nb-mute uppercase",
          compact ? "sr-only sm:not-sr-only sm:mb-1.5" : "mb-1.5",
        )}
      >
        {t("label")}
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-nb-line bg-nb-bg p-0.5">
          {IMAGE_FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              aria-pressed={value === format.id}
              aria-label={t("option", {
                ratio: format.id,
                width: format.width,
                height: format.height,
              })}
              onClick={() => onChange(format.id)}
              className={cn(
                "rounded-full py-1.5 text-[11px] font-bold whitespace-nowrap transition-colors disabled:cursor-wait disabled:opacity-60",
                compact ? "px-2 sm:px-3" : "px-3",
                value === format.id ? "bg-nb-ink text-nb-bg" : "text-nb-mute hover:text-nb-ink",
              )}
            >
              {format.id}
            </button>
          ))}
        </div>
        <span
          className={cn("text-[10px] text-nb-mute", compact && "hidden sm:inline")}
          aria-live="polite"
        >
          {profile.width} × {profile.height} px
          {!compact && ` · ${t("quality")}`}
        </span>
      </div>
    </fieldset>
  );
}
