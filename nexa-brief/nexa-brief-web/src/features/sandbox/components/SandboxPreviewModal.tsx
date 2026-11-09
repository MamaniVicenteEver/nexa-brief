"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { MediaPlayerModal, type MediaSource } from "@/shared/components/media/MediaPlayerModal";
import { useSandboxInfo } from "../hooks/useSandboxInfo";
import { SandboxComponentsPicker } from "./SandboxComponentsPicker";
import { SandboxInfoSidebar } from "./SandboxInfoSidebar";

export function SandboxPreviewModal({
  target,
  title,
  folder,
  id,
  showInfo = true,
  showComponents = true,
  children,
}: {
  target: MediaSource | null;
  title: string;
  folder: string;
  id: string;
  showInfo?: boolean;
  showComponents?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("sandbox");
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [outro, setOutro] = useState<1 | 2>(1);
  const info = useSandboxInfo(folder, id, open && showInfo);
  type StyleOption = { id: string; etiqueta: string; tipo: "deslizador" | "opciones"; param: string; min?: number; max?: number; paso?: number; defecto: number | string; unidad?: string; valores?: (number | string)[] };
  const [styles, setStyles] = useState<{ default: string | null; styles: { id: string; name: string; idea?: string }[]; options?: StyleOption[] }>({
    default: null,
    styles: [],
  });
  const [values, setValues] = useState<Record<string, string | number>>({});
  useEffect(() => {
    // Estilos que la API ofrece para esta plantilla (misma API para cualquier plantilla con estilos).
    if (!open) return;
    const controller = new AbortController();
    fetch(resolveApiUrl(`/api/v1/showcase/designs/${encodeURIComponent(id)}/styles?folder=${encodeURIComponent(folder)}`), {
      signal: controller.signal,
      credentials: "same-origin",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (value && Array.isArray(value.styles)) {
          setStyles(value);
          setValues(Object.fromEntries((value.options ?? []).map((o: StyleOption) => [o.param, o.defecto])));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [open, id, folder]);

  if (!target) return children;

  const components = info.data?.info?.components;
  const hasGeopoliticalOutro = folder === "nodepolitics" && id === "resumen-geopolitico-demo";
  const baseUrl = target.kind === "iframe" ? previewUrl ?? resolveApiUrl(target.url) : "";
  const [pathAndQuery, hash] = baseUrl.split("#", 2);
  const [path, query = ""] = pathAndQuery.split("?", 2);
  const params = new URLSearchParams(query);
  if (hasGeopoliticalOutro && outro === 2) params.set("scene", "assets/scene-outrov2.json");
  const iframeUrl = hasGeopoliticalOutro && outro === 2
    ? `${path}?${params.toString()}${hash ? `#${hash}` : ""}`
    : baseUrl;

  const source: MediaSource =
    target.kind === "iframe"
      ? {
          ...target,
          url: iframeUrl,
          poster: target.poster ? resolveApiUrl(target.poster) : null,
        }
      : {
          ...target,
          desktopUrl: target.desktopUrl ? resolveApiUrl(target.desktopUrl) : null,
          mobileUrl: target.mobileUrl ? resolveApiUrl(target.mobileUrl) : null,
        };

  return (
    <MediaPlayerModal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPreviewUrl(null);
      }}
      title={title}
      description={t("previewHint")}
      source={source}
      styleOptions={styles.styles}
      defaultStyle={styles.default}
      extraParams={values}
      trigger={children}
      sidebar={
        showInfo ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {hasGeopoliticalOutro && target.kind === "iframe" && (
              <section aria-label="Cierre del video" className="space-y-2 border-b border-nb-line px-4 py-3 text-xs">
                <h3 className="font-semibold uppercase tracking-wide text-nb-mute">Cierre del video</h3>
                <div className="flex gap-2">
                  {([1, 2] as const).map((variant) => (
                    <button key={variant} type="button" aria-pressed={outro === variant}
                      onClick={() => { setPreviewUrl(null); setOutro(variant); }}
                      className="rounded-full border border-nb-line px-3 py-1.5 font-medium aria-pressed:border-nb-ink aria-pressed:bg-nb-ink aria-pressed:text-white">
                      Outro {variant}
                    </button>
                  ))}
                </div>
                <p className="text-nb-mute">Al cambiar el cierre, el video vuelve a empezar.</p>
              </section>
            )}
            {styles.options && styles.options.length > 0 && (
              <section aria-label="Opciones de estilo" className="space-y-3 border-b border-nb-line px-4 py-3 text-xs">
                <h3 className="font-semibold uppercase tracking-wide text-nb-mute">Opciones</h3>
                {styles.options.map((option) => (
                  <div key={option.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span>{option.etiqueta}</span>
                      {option.tipo === "deslizador" && (
                        <span className="tabular-nums text-nb-mute">
                          {values[option.param]}
                          {option.unidad}
                        </span>
                      )}
                    </div>
                    {option.tipo === "deslizador" ? (
                      <input
                        type="range"
                        aria-label={option.etiqueta}
                        min={option.min}
                        max={option.max}
                        step={option.paso}
                        value={Number(values[option.param])}
                        onChange={(event) => setValues((current) => ({ ...current, [option.param]: Number(event.target.value) }))}
                        className="w-full accent-black"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(option.valores ?? []).map((valor) => (
                          <button
                            key={String(valor)}
                            type="button"
                            aria-pressed={values[option.param] === valor}
                            onClick={() => setValues((current) => ({ ...current, [option.param]: valor }))}
                            className="rounded-full border border-nb-line px-2.5 py-1 font-medium aria-pressed:border-nb-ink aria-pressed:bg-nb-ink aria-pressed:text-white"
                          >
                            {String(valor)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <p className="text-nb-mute">Los cambios recargan el video (unos segundos).</p>
              </section>
            )}
            {showComponents &&
              open &&
              target.kind === "iframe" &&
              components &&
              components.length > 0 && (
                <SandboxComponentsPicker
                  key={`${folder}:${id}`}
                  folder={folder}
                  id={id}
                  components={components}
                  onPreview={setPreviewUrl}
                />
              )}
            <SandboxInfoSidebar
              title={title}
              data={info.data}
              isLoading={info.isLoading}
              isError={info.isError}
            />
          </div>
        ) : undefined
      }
      sidebarToggleLabel={t("info.toggleSidebar")}
    />
  );
}
