"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ChannelPlatform, VideoFormat } from "../types";

const FORMATS: VideoFormat[] = ["16x9", "9x16"];

/** Formato sugerido por red: YouTube y Facebook horizontal; Instagram y TikTok vertical. */
export const DEFAULT_FORMAT: Record<ChannelPlatform, VideoFormat> = {
  youtube: "16x9",
  facebook: "16x9",
  instagram: "9x16",
  tiktok: "9x16",
};

/** YouTube recibe siempre el horizontal: no se le ofrece elegir. */
export const canPickFormat = (platform: ChannelPlatform) => platform !== "youtube";

/** Selector 16:9 / 9:16 de UNA cuenta: un solo formato por publicación. */
export function PublishFormatPicker({
  value,
  onChange,
}: {
  value: VideoFormat;
  onChange: (format: VideoFormat) => void;
}) {
  const t = useTranslations("schedule.publishNow");
  return (
    <fieldset
      aria-label={t("formatLabel")}
      className="ml-9 inline-flex rounded-full border border-nb-line bg-nb-surface p-0.5"
    >
      {FORMATS.map((format) => (
        <button
          key={format}
          type="button"
          aria-pressed={value === format}
          onClick={() => onChange(format)}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
            value === format ? "bg-nb-ink text-nb-surface" : "text-nb-ink-soft hover:bg-nb-bg-2",
          )}
        >
          {t(`formats.${format}`)}
        </button>
      ))}
    </fieldset>
  );
}
