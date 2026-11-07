"use client";

import { Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import type { ShowcaseDesign, ShowcaseEntry } from "../api/standard-showcase-repository";
import { StandardShowcasePreview } from "./StandardShowcasePreview";

export function ShowcasePoster({ design, entry, format, suspended }: {
  design: ShowcaseDesign;
  entry: ShowcaseEntry;
  format: "9x16" | "16x9";
  suspended: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [poster, setPoster] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => () => { if (poster) URL.revokeObjectURL(poster); }, [poster]);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([value]) => setVisible(value.isIntersecting), { rootMargin: "100px" });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setPlaying(false);
    setPoster("");
    setFailed(false);
  }, [design.id, design.revision, entry.id, format]);
  useEffect(() => {
    if (!visible || entry.preview_kind !== "iframe" || !entry.preview_url || poster || failed) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const url = resolveApiUrl(`/api/v1/showcase/designs/${encodeURIComponent(design.id)}/poster?entry=${encodeURIComponent(entry.id)}&format=${format}`);
    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal, credentials: "same-origin" });
        if (response.status === 202) { timer = setTimeout(load, 2000); return; }
        if (!response.ok) throw new Error("poster unavailable");
        const blob = await response.blob();
        if (!controller.signal.aborted) setPoster(URL.createObjectURL(blob));
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [design.id, design.revision, entry.id, entry.preview_kind, entry.preview_url, failed, format, poster, visible]);

  if (entry.preview_kind !== "iframe" || !entry.preview_url)
    return <StandardShowcasePreview entry={entry} format={format} suspended={suspended} />;
  return (
    <div ref={host} className="relative flex h-full w-full items-center justify-center overflow-hidden bg-white">
      {poster ? <img src={poster} alt={`Vista previa de ${entry.label}`} className="absolute inset-0 h-full w-full object-contain" /> :
        <p className="p-4 text-center text-xs text-nb-ink-soft">{failed ? "Vista previa no disponible" : "Preparando imagen…"}</p>}
      {playing && visible && !suspended && <div className="absolute inset-0"><StandardShowcasePreview entry={entry} format={format} /></div>}
      <button type="button" aria-label={`${playing ? "Detener" : "Reproducir"} ${entry.label}`}
        onClick={(event) => { event.stopPropagation(); setPlaying((value) => !value); }}
        className="absolute bottom-3 left-3 grid size-9 place-items-center rounded-full border border-nb-line bg-white text-nb-ink shadow-sm">
        {playing ? <Square className="size-4" /> : <Play className="size-4" />}
      </button>
    </div>
  );
}
