"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ShowcaseRepository } from "../api/showcase-repository";
import { useLazyStage } from "../hooks/useLazyStage";
import { getFormat } from "../lib/formats";
import { isolatedPosterUrl } from "../lib/kit-urls";
import type { CatalogContext, FormatId, Item } from "../types";
import { IconAction } from "./IconAction";
import type { PreviewFramePosition } from "./PreviewFrameSelector";
import { SandboxAnimationPreview } from "./SandboxAnimationPreview";

export type PreviewProps = { src: string; title: string; format: FormatId; componentName: string };

function PreviewFrame({ src, title, componentName }: Omit<PreviewProps, "format">) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const interval = window.setInterval(() => {
      try {
        const stage = frameRef.current?.contentWindow as
          | (Window & {
              Kit?: { registry?: Map<string, unknown> };
              __promo?: unknown;
            })
          | null;
        if (stage?.__promo && stage.Kit?.registry?.has(componentName)) {
          window.clearInterval(interval);
          window.clearTimeout(timeout);
        }
      } catch {
        // Un frame inaccesible nunca se confirma como cargado.
      }
    }, 250);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setFailed(true);
    }, 30_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [componentName]);
  return (
    <>
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        loading="eager"
        className="absolute inset-0 h-full w-full border-0"
      />
      {failed && (
        <p
          role="alert"
          className="absolute inset-0 grid place-items-center bg-black/90 p-4 text-center text-sm text-white"
        >
          No se pudo cargar el componente. Prueba repetir la animación.
        </p>
      )}
    </>
  );
}

export function StagePreview({ src, title, format, componentName }: PreviewProps) {
  const { hostRef, shouldMount, replayKey, replay } = useLazyStage(src);
  const preset = getFormat(format);

  return (
    <div ref={hostRef} className="relative flex h-full items-center justify-center bg-black">
      <div
        className="relative max-h-full max-w-full"
        style={{
          aspectRatio: `${preset.width} / ${preset.height}`,
          // 400 px de tarjeta, menos pie (56 px) y bordes (2 px).
          width: `min(100%, ${(342 * preset.width) / preset.height}px)`,
        }}
      >
        {shouldMount ? (
          <PreviewFrame
            key={`${src}:${replayKey}`}
            src={src}
            title={title}
            componentName={componentName}
          />
        ) : (
          <p className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-white/60">
            La vista previa se cargará al acercarse a la pantalla.
          </p>
        )}
      </div>
      <IconAction
        label={`Repetir animación ${title}`}
        className="absolute right-3 top-3 z-10 bg-black/70 text-white hover:bg-black"
        onClick={replay}
      >
        <RotateCcw />
      </IconAction>
    </div>
  );
}

/** Resuelve el puerto en el contenedor de preview; la grilla solo pasa props. */
export function ItemPreview({
  item,
  context,
  repo,
  format,
  suspended = false,
  framePosition = "first",
}: {
  item: Item;
  context: CatalogContext;
  repo: ShowcaseRepository;
  format: FormatId;
  suspended?: boolean;
  framePosition?: PreviewFramePosition;
}) {
  let src: string;
  let error = item.unavailableReason;
  try {
    src = error ? "" : repo.previewUrl(item, context, "card");
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "No se pudo preparar la vista previa.";
    src = "";
  }
  if (error || !src) {
    return (
      <div className="grid h-full place-items-center bg-muted p-4 text-center text-sm text-muted-foreground">
        <p role="status">Vista previa no disponible. {error}</p>
      </div>
    );
  }
  const poster =
    framePosition === "first"
      ? isolatedPosterUrl(item.designId, item.component.name, format, item.source)
      : undefined;
  const preset = getFormat(format);
  const duration = Number(new URL(src, "http://localhost").searchParams.get("dur")) || 6;
  const time =
    framePosition === "first"
      ? 0
      : framePosition === "middle"
        ? duration / 2
        : Math.max(0, duration - 0.5);
  const stillSrc = `${src}${src.includes("?") ? "&" : "?"}t=${time}`;
  return (
    <SandboxAnimationPreview
      title={item.component.name}
      frameTitle={`Vista previa de ${item.component.name}`}
      src={src}
      poster={poster}
      stillSrc={stillSrc}
      bg="white"
      waitForReady
      suspended={suspended}
      aspect={`${preset.width} / ${preset.height}`}
    />
  );
}
