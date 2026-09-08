"use client";

import { Play, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import { HtmlPreviewFrame } from "./HtmlPreviewFrame";
import "./LivePreview.css";
import { PreviewModal } from "./PreviewModal";

interface LivePreviewProps {
  /** HTML combinado (html+css+js) ya armado por useTemplateEditorState. */
  doc: string;
}

/**
 * Panel "Preview en vivo" con controles Play/Stop — responsabilidad única:
 * decidir SI se muestra el resultado, no cómo se arma (eso lo hace
 * useTemplateEditorState, que sigue actualizando `doc` aunque esté
 * detenido — el cambio recién se ve al volver a dar Play).
 *
 * "Detener" no pausa el iframe (no hay forma genérica de pausar JS/CSS
 * arbitrario de terceros) — directamente lo desmonta, así queda
 * garantizado que nada sigue corriendo. "Reproducir" lo vuelve a montar
 * con una key nueva, forzando que arranque de cero (frame 0), igual que
 * lo haría el motor de render real.
 */
export function LivePreview({ doc }: LivePreviewProps) {
  const t = useTranslations("templateDetail");
  const [isPlaying, setIsPlaying] = useState(true);
  const [runId, setRunId] = useState(0);

  function handlePlay() {
    setIsPlaying(true);
    setRunId((id) => id + 1);
  }

  return (
    <div className="nr-live-preview">
      <div className="nr-live-preview__label">
        <span>{t("livePreview")}</span>
        <div className="nr-live-preview__controls">
          <PreviewModal
            title={t("livePreview")}
            openLabel={t("expandPreview")}
            closeLabel={t("closePreview")}
          >
            <HtmlPreviewFrame doc={doc} title={t("livePreview")} />
          </PreviewModal>
          <button
            type="button"
            className={cn("nr-live-preview__btn", isPlaying && "is-active")}
            aria-label={t("playPreview")}
            aria-pressed={isPlaying}
            onClick={handlePlay}
          >
            <Play size={13} fill="currentColor" />
          </button>
          <button
            type="button"
            className={cn("nr-live-preview__btn", !isPlaying && "is-active")}
            aria-label={t("stopPreview")}
            aria-pressed={!isPlaying}
            onClick={() => setIsPlaying(false)}
          >
            <Square size={12} fill="currentColor" />
          </button>
        </div>
      </div>

      <div className="nr-live-preview__screen">
        {isPlaying ? (
          <HtmlPreviewFrame
            key={runId}
            doc={doc}
            title="preview"
            className="nr-live-preview__frame"
          />
        ) : (
          <div className="nr-live-preview__frame nr-live-preview__frame--stopped">
            {t("previewStopped")}
          </div>
        )}
      </div>
    </div>
  );
}
