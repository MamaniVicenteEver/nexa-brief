"use client";

import { useTranslations } from "next-intl";
import type { ResearchCard as ResearchCardData } from "../domain/research";

interface ResearchCardProps {
  card: ResearchCardData;
  onOpen: () => void;
}

const chip = "rounded-full bg-nb-bg-2 px-2 py-0.5 text-[11px] text-nb-ink-soft";

/** Tarjeta de una investigación: portada, tema, datos y acceso al detalle. */
export function ResearchCard({ card, onOpen }: ResearchCardProps) {
  const t = useTranslations("resources.research");
  const originRoot = card.originRoot === "production" ? "production" : "sandbox";
  const meta = [
    card.researchedAt,
    `${t(`origin.${originRoot}`)} · ${card.originCategory}`,
    card.versionCount > 1 ? t("versions", { count: card.versionCount }) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const tags = card.tags.filter((tag) => tag !== card.originRoot && tag !== card.originCategory);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-nb-line bg-nb-surface shadow-[0_3px_16px_-10px_rgba(0,0,0,0.18)] transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.22)]">
      {card.coverUrl ? (
        // biome-ignore lint/performance/noImgElement: URL del backend, no un asset estático de Next
        <img
          src={card.coverUrl}
          alt=""
          loading="lazy"
          className="aspect-video w-full bg-nb-bg-2 object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-nb-bg-2 text-[12px] text-nb-mute">
          {t("noCover")}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <h3
          className="line-clamp-2 break-words text-[13px] leading-snug font-semibold text-nb-ink"
          title={card.topic}
        >
          {card.topic}
        </h3>
        <p className="truncate text-[11.5px] text-nb-mute" title={meta}>
          {meta}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className={chip}>{t("counts.findings", { count: card.counts.findings })}</span>
          <span className={chip}>{t("counts.sources", { count: card.counts.sources })}</span>
          <span className={chip}>{t("counts.images", { count: card.counts.images })}</span>
          <span className={chip}>{t("counts.videos", { count: card.counts.videos })}</span>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className={chip}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex justify-end pt-1">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold text-nb-green-dark hover:bg-nb-green/20"
          >
            {t("view")}
          </button>
        </div>
      </div>
    </article>
  );
}
