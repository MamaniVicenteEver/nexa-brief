"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import "./HtmlPreviewFrame.css";

interface HtmlPreviewFrameProps {
  doc: string;
  title: string;
  className?: string;
}

/**
 * Iframe de preview sin lógica de negocio. Si el HTML declara un canvas
 * HyperFrames, conserva su viewport original y lo escala desde afuera.
 */
export function HtmlPreviewFrame({ doc, title, className }: HtmlPreviewFrameProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostSize, setHostSize] = useState({ width: 0, height: 0 });
  const compositionSize = useMemo(() => {
    const width = Number(doc.match(/data-width=["'](\d+)["']/)?.[1]);
    const height = Number(doc.match(/data-height=["'](\d+)["']/)?.[1]);
    return width > 0 && height > 0 ? { width, height } : undefined;
  }, [doc]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new ResizeObserver(([entry]) => {
      setHostSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const scale = compositionSize
    ? Math.min(hostSize.width / compositionSize.width, hostSize.height / compositionSize.height)
    : 1;

  return (
    <div
      ref={hostRef}
      className={cn(
        "nr-html-preview-frame",
        compositionSize && "nr-html-preview-frame--composition",
        className,
      )}
    >
      <iframe
        title={title}
        srcDoc={doc}
        sandbox="allow-scripts"
        className="nr-html-preview-frame__iframe"
        style={
          compositionSize
            ? {
                width: compositionSize.width,
                height: compositionSize.height,
                transform: `translate(-50%, -50%) scale(${Number.isFinite(scale) ? scale : 0})`,
              }
            : undefined
        }
      />
    </div>
  );
}
