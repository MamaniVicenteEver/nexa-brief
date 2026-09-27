"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { Template } from "../types";

const ORIENTATION_LABEL_KEY: Record<Template["nativeOrientation"], string> = {
  "9:16": "card.orientationVertical",
  "16:9": "card.orientationHorizontal",
  any: "card.orientationAny",
};

// Mismas imágenes que usa la fila de plantillas de la home
// (TemplatesRow.tsx) — los 3 templates de letras comparten una sola
// imagen genérica porque todavía no hay una miniatura por variante.
const PREVIEW_IMAGE: Record<string, string> = {
  "01-image-bg": "/images/templates/image-bg.png",
  "subject-spotlight": "/images/templates/subject-png.png",
  "living-landscape": "/images/templates/landscape-scene.png",
  "motion-backdrop": "/images/templates/video-motion.png",
  "lyrics-neon": "/images/templates/lyrics.png",
  "lyrics-impact": "/images/templates/lyrics.png",
  "lyrics-romantic": "/images/templates/lyrics.png",
};

export function TemplateCard({ template }: { template: Template }) {
  const t = useTranslations("templates");
  const previewSrc = PREVIEW_IMAGE[template.id];

  return (
    <Link
      href={`/plantillas/${template.id}`}
      className={cn(
        "flex flex-col gap-3 rounded-[20px] bg-nb-surface p-5.5 no-underline transition-transform hover:-translate-y-0.5",
        "shadow-[0_18px_34px_-16px_rgba(40,30,10,0.16),0_6px_14px_-4px_rgba(40,30,10,0.07),inset_0_1px_0_rgba(255,255,255,0.7)]",
      )}
    >
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-nb-bg-2 to-nb-line text-nb-ink-soft">
        {previewSrc ? (
          <Image
            src={previewSrc}
            alt={template.displayName}
            fill
            sizes="(max-width: 700px) 100vw, 360px"
            className="object-cover"
          />
        ) : (
          <span className="text-[13px] font-semibold">
            {t(ORIENTATION_LABEL_KEY[template.nativeOrientation])}
          </span>
        )}
      </div>
      <h4 className="text-[15px] font-bold tracking-[-0.015em] text-nb-ink">
        {template.displayName}
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {template.requiresImage && (
          <span className="rounded-full bg-nb-bg-2 px-2.5 py-1 text-[11px] font-semibold text-nb-ink-soft">
            {t("card.tagImage")}
          </span>
        )}
        {template.requiresVideo && (
          <span className="rounded-full bg-nb-bg-2 px-2.5 py-1 text-[11px] font-semibold text-nb-ink-soft">
            {t("card.tagVideo")}
          </span>
        )}
        {template.requiresLyrics && (
          <span className="rounded-full bg-nb-bg-2 px-2.5 py-1 text-[11px] font-semibold text-nb-ink-soft">
            {t("card.tagLyrics")}
          </span>
        )}
      </div>
    </Link>
  );
}
