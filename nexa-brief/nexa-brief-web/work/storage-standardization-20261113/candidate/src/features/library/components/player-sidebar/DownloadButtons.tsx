"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { cn } from "@/lib/utils";

const BUTTON =
  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-nb-line px-3 py-2 text-[12.5px] font-semibold text-nb-ink transition-colors hover:bg-nb-bg-2";

/** Descargas del video terminado: la miniatura (la misma que se sube a YouTube) y el 9:16 para subir a
 * mano a TikTok u otras cuentas que no están conectadas. */
export function DownloadButtons({ jobId, hasVertical }: { jobId: string; hasVertical: boolean }) {
  const t = useTranslations("library.playerSidebar.downloads");
  const url = (format: "thumbnail" | "reels") =>
    resolveApiUrl(`/api/v1/videos/jobs/${jobId}/file/${format}?download=1`);

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <a href={url("thumbnail")} download className={BUTTON}>
          <Download className="size-3.5" />
          {t("thumbnail")}
        </a>
        {hasVertical ? (
          <a href={url("reels")} download className={BUTTON}>
            <Download className="size-3.5" />
            {t("vertical")}
          </a>
        ) : (
          <span
            aria-disabled="true"
            title={t("noVertical")}
            className={cn(BUTTON, "cursor-not-allowed opacity-45 hover:bg-transparent")}
          >
            <Download className="size-3.5" />
            {t("vertical")}
          </span>
        )}
      </div>
      {!hasVertical && <p className="text-[11px] text-nb-mute">{t("noVertical")}</p>}
    </section>
  );
}
