"use client";

import { useEffect, useState } from "react";
import type {
  EngineName,
  Fps,
  TemplateDetail,
  VideoFormat,
  WorkerTarget,
} from "@/infrastructure/api/types";

/**
 * Extraído de render-editor.tsx: todo el estado del editor (html/css/js +
 * config + preview debounced) vive acá — el componente queda como una
 * función de render más chica, responsabilidad única (estado vs. UI).
 */
export function useTemplateEditorState(template: TemplateDetail) {
  const initialHtml = template.input.kind === "html" ? template.input : undefined;
  const initialReact = template.input.kind === "react" ? template.input : undefined;

  const [html, setHtml] = useState(initialHtml?.html ?? "");
  const [css, setCss] = useState(initialHtml?.css ?? "");
  const [js, setJs] = useState(initialHtml?.js ?? "");
  const [componentSource, setComponentSource] = useState(initialReact?.componentSource ?? "");
  const [propsJson, setPropsJson] = useState(JSON.stringify(initialReact?.props ?? {}, null, 2));
  const [engine, setEngine] = useState<EngineName | "auto">(template.engine);
  const [worker, setWorker] = useState<WorkerTarget>("local");
  const [fps, setFps] = useState<Fps>(30);
  // Esta plantilla se concibió como Reel/TikTok. El resto conserva los
  // valores de partida del editor para no imponer el formato vertical a
  // composiciones horizontales.
  const isVerticalAd = template.slug === "playwright-basic";
  const [durationSeconds, setDurationSeconds] = useState(isVerticalAd ? 11 : 5);
  const [formats, setFormats] = useState<VideoFormat[]>([isVerticalAd ? "mobile" : "desktop"]);
  const [previewDoc, setPreviewDoc] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setPreviewDoc(
        `<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}<script>${js}</script></body></html>`,
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [html, css, js]);

  function toggleFormat(format: VideoFormat) {
    setFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format],
    );
  }

  return {
    html,
    setHtml,
    css,
    setCss,
    js,
    setJs,
    componentSource,
    setComponentSource,
    propsJson,
    setPropsJson,
    engine,
    setEngine,
    worker,
    setWorker,
    fps,
    setFps,
    durationSeconds,
    setDurationSeconds,
    formats,
    toggleFormat,
    previewDoc,
  };
}
