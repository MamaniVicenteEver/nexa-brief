"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import type { Fps, VideoFormat } from "@/infrastructure/api/types";
import { cn } from "@/shared/lib/utils";
import { PreviewModal } from "./PreviewModal";
import "./RemotionPreview.css";

interface RemotionPreviewProps {
  componentSource: string;
  propsJson: string;
  fps: Fps;
  durationSeconds: number;
  format: VideoFormat;
}

/** Cuadro PNG real generado por Remotion; se refresca tras pausar la escritura. */
export function RemotionPreview({
  componentSource,
  propsJson,
  fps,
  durationSeconds,
  format,
}: RemotionPreviewProps) {
  const t = useTranslations("templateDetail");
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let createdUrl: string | undefined;
    const timer = setTimeout(async () => {
      let props: Record<string, unknown>;
      try {
        props = JSON.parse(propsJson || "{}") as Record<string, unknown>;
      } catch {
        setError(t("remotionPreviewInvalidProps"));
        return;
      }

      setIsLoading(true);
      setError(undefined);
      try {
        const response = await fetch(resolveApiUrl("/api/v1/previews/remotion"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Preview-Refresh": String(refreshKey),
          },
          body: JSON.stringify({ componentSource, props, fps, durationSeconds, format }),
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => undefined)) as
            | { detail?: string }
            | undefined;
          throw new Error(body?.detail ?? t("remotionPreviewError"));
        }
        createdUrl = URL.createObjectURL(await response.blob());
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return createdUrl;
        });
      } catch (previewError) {
        if (!controller.signal.aborted) {
          setError(
            previewError instanceof Error ? previewError.message : t("remotionPreviewError"),
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 800);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [componentSource, durationSeconds, format, fps, propsJson, refreshKey, t]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  return (
    <section className="nr-remotion-preview" aria-label={t("remotionPreviewTitle")}>
      <div className="nr-remotion-preview__label">
        <span>{t("remotionPreviewTitle")}</span>
        <div className="nr-remotion-preview__actions">
          {previewUrl ? (
            <PreviewModal
              title={t("remotionPreviewTitle")}
              openLabel={t("expandPreview")}
              closeLabel={t("closePreview")}
            >
              {/* biome-ignore lint/performance/noImgElement: blob URLs are transient renderer responses, not Next image assets. */}
              <img src={previewUrl} alt={t("remotionPreviewImageAlt")} />
            </PreviewModal>
          ) : null}
          <button
            type="button"
            className={cn("nr-remotion-preview__refresh", isLoading && "is-loading")}
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={isLoading}
            aria-label={t("remotionPreviewRefresh")}
          >
            <RefreshCw size={14} />
            {isLoading ? t("remotionPreviewRendering") : t("remotionPreviewRefresh")}
          </button>
        </div>
      </div>
      <div className="nr-remotion-preview__canvas">
        {previewUrl ? (
          // biome-ignore lint/performance/noImgElement: blob URLs are transient renderer responses, not Next image assets.
          <img src={previewUrl} alt={t("remotionPreviewImageAlt")} />
        ) : null}
        {!previewUrl && !error ? <span>{t("remotionPreviewWaiting")}</span> : null}
        {error ? <p>{error}</p> : null}
      </div>
    </section>
  );
}
