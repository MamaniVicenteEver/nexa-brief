"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useCaptureThumbnails, useChooseThumbnail } from "../hooks/useExplainer";
import type { ExplainerVideo, ThumbnailOptionId } from "../types";

/**
 * Miniatura y apertura: A = introv1 (solo texto, por defecto), B = introv2 (texto + foto).
 * La elegida abre el video (primeros segundos), su captura es la miniatura de YouTube y queda
 * guardada en el video; cambiarla obliga a grabar de nuevo con la nueva apertura.
 */
export function ThumbnailPicker({ video }: { video: ExplainerVideo }) {
  const t = useTranslations("explainer.studio.thumbnail");
  const capture = useCaptureThumbnails();
  const choose = useChooseThumbnail();
  const { chosen, options } = video.thumbnails;
  if (options.length === 0) return null;
  const busy = capture.isPending || choose.isPending;
  const missing = options.some((o) => !o.url);
  const pick = (option: ThumbnailOptionId) => {
    if (option !== chosen) choose.mutate({ videoId: video.videoId, option });
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold text-nb-ink">{t("heading")}</h3>
        <button
          type="button"
          disabled={busy}
          onClick={() => capture.mutate(video.videoId)}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-nb-ink-soft disabled:opacity-50"
        >
          {capture.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          {missing ? t("capture") : t("recapture")}
        </button>
      </div>
      <p className="text-[11.5px] text-nb-mute">{t("hint")}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.option}
            type="button"
            aria-pressed={o.option === chosen}
            disabled={busy}
            onClick={() => pick(o.option)}
            className={cn(
              "flex flex-col gap-1 rounded-xl border p-1.5 text-left disabled:opacity-60",
              o.option === chosen ? "border-nb-ink bg-nb-bg-2" : "border-nb-line",
            )}
          >
            {o.url ? (
              // biome-ignore lint/performance/noImgElement: captura servida por la API, sin optimizar
              <img
                src={o.url}
                alt=""
                className="aspect-video w-full rounded-lg bg-black object-cover"
              />
            ) : (
              <span className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-nb-line text-[10.5px] text-nb-mute">
                {t("notCaptured")}
              </span>
            )}
            <span className="text-[11.5px] font-semibold text-nb-ink">
              {t(`option.${o.option}`)}
            </span>
          </button>
        ))}
      </div>
      {(capture.error || choose.error) && (
        <p className="text-[12px] text-red-600">{(capture.error ?? choose.error)?.message}</p>
      )}
    </section>
  );
}
