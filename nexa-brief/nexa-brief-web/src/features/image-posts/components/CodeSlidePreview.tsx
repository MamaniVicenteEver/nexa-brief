"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useImageCodePreview } from "../hooks/useImageCodePreview";
import type { ImagePostFormat } from "../image-formats";
import { CodeSlideFrame } from "./CodeSlideFrame";

export function CodeSlidePreview({
  postId,
  slideId,
  format,
  revision,
  title,
  decorative = false,
  fallbackUrl,
  onReady,
}: {
  postId: string;
  slideId: string;
  format: ImagePostFormat;
  revision?: number;
  title: string;
  decorative?: boolean;
  fallbackUrl?: string;
  onReady?: () => void;
}) {
  const t = useTranslations("imagePosts.formats");
  const query = useImageCodePreview({ postId, slideId, format, revision });
  const [loadedHtml, setLoadedHtml] = useState<string | null>(null);
  const ready = Boolean(query.data && loadedHtml === query.data.html);

  return (
    <div
      className="relative size-full overflow-hidden bg-black"
      aria-hidden={decorative || undefined}
      aria-busy={!ready && !query.isError}
    >
      {fallbackUrl && (
        // biome-ignore lint/performance/noImgElement: authenticated preview stays visible during the editable document's first load.
        <img
          src={fallbackUrl}
          alt={!decorative && !ready ? title : ""}
          aria-hidden={ready || decorative || undefined}
          className="absolute inset-0 size-full object-contain"
          style={{ visibility: ready ? "hidden" : "visible" }}
          draggable={false}
        />
      )}
      {query.data && (
        <div
          className="absolute inset-0 transition-opacity duration-150 motion-reduce:transition-none"
          style={{ opacity: ready ? 1 : 0 }}
        >
          <CodeSlideFrame
            html={query.data.html}
            width={query.data.width}
            height={query.data.height}
            title={decorative ? "" : title}
            onLoad={() => {
              setLoadedHtml(query.data.html);
              onReady?.();
            }}
          />
        </div>
      )}
      {!decorative && !ready && (
        <div
          className={
            fallbackUrl
              ? "absolute right-3 bottom-3 flex max-w-[85%] items-center gap-2 rounded-lg bg-black/75 p-2 text-center text-white/80"
              : "absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-white/70"
          }
        >
          {query.isError ? (
            <>
              <AlertCircle className="size-5 shrink-0" />
              <p className="text-xs">{t("previewError")}</p>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className="rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold text-white"
              >
                {t("retry")}
              </button>
            </>
          ) : (
            <LoaderCircle className="size-5 animate-spin" aria-label={t("loading")} />
          )}
        </div>
      )}
    </div>
  );
}
