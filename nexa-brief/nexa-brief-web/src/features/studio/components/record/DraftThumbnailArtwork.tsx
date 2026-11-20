"use client";

import { useEffect, useState } from "react";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { cn } from "@/lib/utils";
import type { DraftThumbnailManifest } from "../../hooks/useDraftThumbnailEditor";
import type { DraftThumbnailOptionId } from "../../types";

interface ThumbnailRenderer {
  version?: number;
  renderSvgAsync?: (
    manifest: DraftThumbnailManifest,
    option: DraftThumbnailOptionId,
    width?: number,
    height?: number,
    settings?: { resolveUrl: (path: string) => string },
  ) => Promise<string>;
  renderSvg: (
    manifest: DraftThumbnailManifest,
    option: DraftThumbnailOptionId,
    width?: number,
    height?: number,
  ) => string;
}

declare global {
  interface Window {
    NexaDraftThumbnailRenderer?: ThumbnailRenderer;
  }
}

let rendererPromise: Promise<ThumbnailRenderer | null> | null = null;
const RENDERER_VERSION = 26;

function loadRenderer(attemptKey = 0): Promise<ThumbnailRenderer | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.NexaDraftThumbnailRenderer?.version === RENDERER_VERSION)
    return Promise.resolve(window.NexaDraftThumbnailRenderer);
  if (rendererPromise) return rendererPromise;

  rendererPromise = new Promise<ThumbnailRenderer | null>((resolve) => {
    if (window.NexaDraftThumbnailRenderer && window.NexaDraftThumbnailRenderer.version !== RENDERER_VERSION) {
      document.querySelector('script[data-nexa-thumbnail-renderer="true"]')?.remove();
      delete window.NexaDraftThumbnailRenderer;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-nexa-thumbnail-renderer="true"]',
    );
    const script = existing ?? document.createElement("script");
    const finish = (renderer: ThumbnailRenderer | null) => resolve(renderer);
    script.addEventListener("load", () => finish(window.NexaDraftThumbnailRenderer ?? null), {
      once: true,
    });
    script.addEventListener("error", () => finish(null), { once: true });
    if (!existing) {
      script.src = resolveApiUrl(`/api/v1/drafts/thumbnail-renderer.js?v=${RENDERER_VERSION}`);
      script.async = true;
      script.dataset.nexaThumbnailRenderer = "true";
      script.dataset.attempt = String(attemptKey);
      document.head.appendChild(script);
    }
  }).catch(() => null);
  return rendererPromise ?? Promise.resolve(null);
}

export function retryDraftThumbnailRenderer() {
  rendererPromise = null;
  document
    .querySelector<HTMLScriptElement>('script[data-nexa-thumbnail-renderer="true"]')
    ?.remove();
  return loadRenderer();
}

function fallbackColors(manifest: DraftThumbnailManifest) {
  const design = manifest.options.A.design ?? manifest.options.B.design ?? {};
  const palette = design.palette as Record<string, unknown> | undefined;
  const background = design.background as Record<string, unknown> | undefined;
  return {
    background: String(palette?.background ?? background?.color ?? "#17202a"),
    foreground: String(palette?.foreground ?? "#ffffff"),
    accent: String(palette?.accent ?? "#f06443"),
  };
}

export function DraftThumbnailArtwork({
  manifest,
  option,
  fallbackUrl,
  className,
  retryKey = 0,
  onRendererError,
}: {
  manifest: DraftThumbnailManifest;
  option: DraftThumbnailOptionId;
  fallbackUrl?: string;
  className?: string;
  retryKey?: number;
  onRendererError?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  // Text/design edits in the other option must not redraw this image.
  const selected = manifest.options[option];
  const editorial = selected.design?.style === "promo-editorial";
  const maxWords =
    option === "B"
      ? Math.max(1, Math.min(5, manifest.options.A.text.trim().split(/\s+/).filter(Boolean).length))
      : 5;
  const manifestKey = JSON.stringify({
    draftId: manifest.draftId,
    format: manifest.format ?? "16x9",
    options: {
      [option]: editorial ? { ...selected, design: { ...selected.design, maxWords } } : selected,
    },
  });
  useEffect(() => {
    let current = true;
    void loadRenderer(retryKey).then(async (renderer) => {
      if (!current) return;
      if (!renderer) {
        onRendererError?.();
        return;
      }
      try {
        const data = JSON.parse(manifestKey) as DraftThumbnailManifest;
        const portrait = data.format === "9x16";
        const width = portrait ? 720 : 1280;
        const height = portrait ? 1280 : 720;
        const svg = renderer.renderSvgAsync
          ? await renderer.renderSvgAsync(data, option, width, height, { resolveUrl: resolveApiUrl })
          : renderer.renderSvg(data, option, width, height);
        const next = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        const image = new Image();
        image.src = next;
        await image.decode();
        if (current) setSrc(next);
      } catch {
        if (current) {
          onRendererError?.();
        }
      }
    });
    return () => {
      current = false;
    };
  }, [manifestKey, option, retryKey, onRendererError]);

  const colors = fallbackColors(manifest);
  const previewText = manifest.options[option].text || "…";
  const portrait = manifest.format === "9x16";
  const classes = cn(
    "relative flex w-full items-center justify-center overflow-hidden",
    portrait ? "aspect-[9/16]" : "aspect-video",
    className,
  );
  const safeAreaGuide = portrait ? (
    <span
      aria-hidden="true"
      data-testid="thumbnail-safe-area"
      className="pointer-events-none absolute left-[6.7%] top-[11.7%] h-[70.3%] w-[72.2%] rounded-md border border-dashed border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.06)]"
    />
  ) : null;
  if (src) {
    return (
      <div className={classes}>
        {/* biome-ignore lint/performance/noImgElement: dynamic SVG is generated by the shared thumbnail renderer */}
        <img src={src} alt={`${option} · ${previewText}`} className="absolute inset-0 size-full" />
        {safeAreaGuide}
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`${option} · ${previewText}`}
      className={classes}
      style={{ backgroundColor: colors.background }}
    >
      {fallbackUrl && (
        // biome-ignore lint/performance/noImgElement: prepared thumbnail is a static legacy fallback
        <img
          src={fallbackUrl}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-35"
        />
      )}
      <span
        className="relative z-10 max-w-[88%] text-center text-balance text-[clamp(1.15rem,3.2vw,2.6rem)] font-black uppercase leading-[.95] drop-shadow-[0_2px_8px_rgba(0,0,0,.7)]"
        style={{ color: colors.foreground, textShadow: `0 2px 18px ${colors.accent}` }}
      >
        {previewText}
      </span>
      {safeAreaGuide}
    </div>
  );
}
