"use client";

import { useState } from "react";
import { type PreviewBackground, previewStyle } from "./SandboxAnimationPreview";

/** Vista fija para componentes que no tienen animación. */
export function SandboxImagePreview({
  poster,
  title,
  bg,
  aspect = "1 / 1",
}: {
  poster?: string;
  title: string;
  bg: PreviewBackground;
  aspect?: string;
}) {
  const [failedPoster, setFailedPoster] = useState<string | null>(null);
  const available = !!poster && failedPoster !== poster;
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ ...previewStyle(bg), aspectRatio: aspect }}
    >
      {available ? (
        // biome-ignore lint/performance/noImgElement: la imagen protegida usa la sesión del navegador.
        <img
          src={poster}
          alt={`Vista previa de ${title}`}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-contain"
          onError={() => setFailedPoster(poster ?? null)}
        />
      ) : (
        <p
          role="status"
          className="absolute inset-x-0 top-3 p-4 text-center text-sm"
          style={{ color: bg === "dark" ? "#fff" : "#152c38" }}
        >
          Imagen no disponible
        </p>
      )}
    </div>
  );
}
