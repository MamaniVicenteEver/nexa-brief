// biome-ignore-all lint/a11y/noNoninteractiveTabindex: el área desplazable debe recibir foco para navegar con teclado.
"use client";

import { useRef, useState } from "react";
import { copyText } from "../lib/clipboard";
import { type CatalogComponent, componentFamily } from "../lib/sandbox-catalog";

/** Documento JSON visible en la biblioteca, sin visor de animación ni diálogo. */
export function SandboxJsonCard({
  item,
  audioSrc,
  captionsSrc,
}: {
  item: CatalogComponent;
  audioSrc?: string;
  captionsSrc?: string;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const json = item.demo === undefined ? null : JSON.stringify(item.demo, null, 2);

  return (
    <article
      ref={containerRef}
      aria-label={item.name}
      className="min-w-0 overflow-hidden rounded-2xl border border-nb-line bg-nb-surface"
    >
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="break-words font-semibold">{item.name}</h2>
            <span className="inline-flex rounded-full border border-nb-line px-2 py-1 text-xs">
              {componentFamily(item)} · JSON
            </span>
          </div>
          {json !== null && (
            <button
              type="button"
              className="rounded-lg border border-nb-line px-3 py-2 text-sm"
              onClick={async () => {
                const copied = await copyText(json, containerRef.current ?? document.body);
                setCopyStatus(copied ? "JSON copiado." : "No se pudo copiar; selecciona el JSON.");
              }}
            >
              Copiar JSON
            </button>
          )}
        </div>
        <p className="text-sm">{item.summary || "Documento JSON."}</p>
        {audioSrc && (
          <div className="space-y-1">
            <p className="text-sm">Muestra de voz</p>
            {captionsSrc ? (
              <audio
                controls
                preload="none"
                src={audioSrc}
                aria-label={`Muestra de voz de ${item.name}`}
                className="w-full"
              >
                <track kind="captions" src={captionsSrc} srcLang="es" label="Español" />
              </audio>
            ) : (
              <a href={audioSrc} className="text-sm underline">
                Abrir muestra de voz (sin transcripción)
              </a>
            )}
          </div>
        )}
        {json === null ? (
          <p className="text-sm">Sin JSON declarado.</p>
        ) : (
          <section
            aria-label={`JSON de ${item.name}`}
            tabIndex={0}
            className="max-h-[32rem] min-w-0 overflow-auto rounded-lg border border-nb-line bg-black/5 p-4 text-xs leading-relaxed focus-visible:outline-2"
          >
            <pre className="whitespace-pre-wrap break-words">
              <code>{json}</code>
            </pre>
          </section>
        )}
        <p role="status" className="text-xs">
          {copyStatus}
        </p>
      </div>
    </article>
  );
}
