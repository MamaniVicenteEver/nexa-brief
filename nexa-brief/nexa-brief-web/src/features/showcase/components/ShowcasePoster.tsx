"use client";

import { useQuery } from "@tanstack/react-query";
import { Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { httpClient, resolveApiUrl } from "@/infrastructure/api/http-client";
import type { ShowcaseDesign, ShowcaseEntry } from "../api/standard-showcase-repository";
import { StandardShowcasePreview } from "./StandardShowcasePreview";
import { useShowcaseStyle } from "../lib/showcase-style";

// The profile-scoped LRU holds blobs, not live iframes or permanent object URLs.
const images = new Map<string, { blob: Blob; checkedAt: number }>();
const remember = (key: string, value: { blob: Blob; checkedAt: number }) => {
  images.delete(key);
  images.set(key, value);
  while (images.size > 120) images.delete(images.keys().next().value as string);
};

export function ShowcasePoster({
  design,
  entry,
  format,
  suspended,
}: {
  design: ShowcaseDesign;
  entry: ShowcaseEntry;
  format: "9x16" | "16x9";
  suspended: boolean;
}) {
  const estilo = useShowcaseStyle();
  const { data: profile } = useQuery({
    queryKey: ["storage-profile"],
    queryFn: () => httpClient<{ id: string; label: string }>("/api/v1/storage/profile"),
    staleTime: 60_000,
    retry: false,
  });
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [poster, setPoster] = useState<{ key: string; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const cacheKey = JSON.stringify([
    profile?.id,
    design.id,
    design.revision,
    entry.id,
    "16x9",
    estilo,
  ]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([value]) => setVisible(value.isIntersecting), {
      rootMargin: "100px",
    });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setPlaying(false);
    setFailed(false);
    setAttempt(0);
  }, [cacheKey]);
  useEffect(() => {
    if (!visible || !profile?.id || entry.preview_kind !== "iframe" || !entry.preview_url) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let currentUrl = "";
    const show = (blob: Blob) => {
      const next = URL.createObjectURL(blob);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = next;
      setPoster({ key: cacheKey, url: next });
    };
    setPoster(null);
    const saved = images.get(cacheKey);
    if (saved) {
      remember(cacheKey, saved);
      show(saved.blob);
      if (Date.now() - saved.checkedAt < 30_000) {
        return () => {
          controller.abort();
          if (currentUrl) URL.revokeObjectURL(currentUrl);
        };
      }
    }
    const params = new URLSearchParams({ entry: entry.id, format: "16x9" });
    if (estilo) params.set("estilo", estilo);
    if (attempt > 0) params.set("retry", "true");
    const url = resolveApiUrl(
      `/api/v1/showcase/designs/${encodeURIComponent(design.id)}/poster?${params}`,
    );
    async function load(first: boolean) {
      try {
        const response = await fetch(first ? url : url.replace(/&retry=true/, ""), {
          signal: controller.signal,
          credentials: "same-origin",
          cache: "no-cache",
        });
        if (response.status === 202) {
          timer = setTimeout(() => void load(false), 3000);
          return;
        }
        if (!response.ok) throw new Error("poster unavailable");
        const blob = await response.blob();
        if (!controller.signal.aborted) {
          remember(cacheKey, { blob, checkedAt: Date.now() });
          show(blob);
          setFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load(true);
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [
    cacheKey,
    design.id,
    entry.id,
    entry.preview_kind,
    entry.preview_url,
    estilo,
    profile?.id,
    visible,
    attempt,
  ]);

  if (entry.preview_kind !== "iframe" || !entry.preview_url)
    return <StandardShowcasePreview entry={entry} format={format} suspended={suspended} />;
  return (
    <div
      ref={host}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-white"
    >
      {poster?.key === cacheKey ? (
        <img
          src={poster.url}
          alt={`Vista previa de ${entry.label}`}
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : (
        <p className="p-4 text-center text-xs text-nb-ink-soft">
          {failed ? "Vista previa no disponible" : "Preparando imagen…"}
        </p>
      )}
      {failed && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
          className="absolute bottom-3 right-3 rounded-full border border-nb-line bg-white px-3 py-1.5 text-xs"
        >
          Reintentar
        </button>
      )}
      {playing && visible && !suspended && (
        <div className="absolute inset-0">
          <StandardShowcasePreview entry={entry} format={format} />
        </div>
      )}
      <button
        type="button"
        aria-label={`${playing ? "Detener" : "Reproducir"} ${entry.label}`}
        onClick={(event) => {
          event.stopPropagation();
          setPlaying((value) => !value);
        }}
        className="absolute bottom-3 left-3 grid size-9 place-items-center rounded-full border border-nb-line bg-white text-nb-ink shadow-sm"
      >
        {playing ? <Square className="size-4" /> : <Play className="size-4" />}
      </button>
    </div>
  );
}
