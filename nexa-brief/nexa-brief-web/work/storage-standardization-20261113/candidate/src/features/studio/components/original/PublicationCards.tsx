"use client";

import { useTranslations } from "next-intl";
import { DETAILS_PLATFORMS, type DraftDetails } from "../../types";

const LABEL = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

/** Cómo queda la publicación en cada red: título, descripción completa y etiquetas. */
export function PublicationCards({ details }: { details: DraftDetails }) {
  const t = useTranslations("studio.details");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-nb-ink-soft">
        <strong className="text-nb-ink">{details.songName || t("noSong")}</strong>
        {details.artist ? ` · ${details.artist}` : ""}
      </p>
      {details.research && (
        <div className="rounded-xl bg-nb-bg-2 px-3 py-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-nb-mute uppercase">
            {t("research")}
          </span>
          <p className="text-[11.5px] whitespace-pre-line text-nb-ink-soft">{details.research}</p>
        </div>
      )}
      {DETAILS_PLATFORMS.map((platform) => {
        const copy = details.copies[platform];
        if (!copy) return null;
        return (
          <article
            key={platform}
            className="flex flex-col gap-1.5 rounded-xl border border-nb-line p-3"
          >
            <span className="text-[10px] font-bold tracking-[0.08em] text-nb-mute uppercase">
              {LABEL[platform]}
            </span>
            <p className="text-[13px] font-semibold text-nb-ink">{copy.title}</p>
            {copy.description && copy.description !== copy.title && (
              <p className="text-[12px] whitespace-pre-line text-nb-ink-soft">{copy.description}</p>
            )}
            {copy.pinned_comment && (
              <div className="mt-1 rounded-lg bg-nb-bg-2 px-2.5 py-2">
                <span className="text-[10px] font-bold text-nb-mute">{t("pinned")}</span>
                <p className="text-[12px] whitespace-pre-line text-nb-ink">{copy.pinned_comment}</p>
              </div>
            )}
            {copy.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {copy.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-nb-bg-2 px-1.5 py-0.5 text-[10px] text-nb-ink-soft"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
