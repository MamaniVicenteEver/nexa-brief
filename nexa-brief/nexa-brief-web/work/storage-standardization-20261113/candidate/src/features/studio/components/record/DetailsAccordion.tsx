"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { DETAILS_PLATFORMS, type DraftDetails } from "../../types";

const LABEL = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

/** Los detalles del prototipo a grabar, cerrados de entrada (se abren para revisarlos). */
export function DetailsAccordion({ details }: { details: DraftDetails }) {
  const t = useTranslations("studio.details");
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-nb-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-bold text-nb-ink">{t("title")}</span>
          <span className="block truncate text-[11px] text-nb-mute">
            {details.songName || t("noSong")}
            {details.artist ? ` · ${details.artist}` : ""}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 text-nb-mute transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-nb-line px-3 py-3">
          {DETAILS_PLATFORMS.map((platform) => {
            const copy = details.copies[platform];
            if (!copy) return null;
            return (
              <div key={platform} className="flex flex-col gap-1">
                <span className="text-[10px] font-bold tracking-[0.08em] text-nb-mute uppercase">
                  {LABEL[platform]}
                </span>
                <p className="text-[12.5px] font-semibold text-nb-ink">{copy.title}</p>
                <p className="line-clamp-4 text-[11.5px] whitespace-pre-line text-nb-ink-soft">
                  {copy.description}
                </p>
                {copy.tags.length > 0 && (
                  <p className="truncate text-[10.5px] text-nb-mute">{copy.tags.join(" · ")}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
