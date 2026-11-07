"use client";

import { Film } from "lucide-react";
import { SandboxPreviewModal } from "@/features/sandbox/components/SandboxPreviewModal";
import { previewTarget } from "@/features/sandbox/lib/urls";
import type { SandboxItem } from "@/features/sandbox/types";
import { resolveApiUrl } from "@/infrastructure/api/http-client";

/** Una muestra de prueba: se reproduce en su ubicación, sin promoverla. */
export function SandboxDesignDemoCard({ item }: { item: SandboxItem }) {
  const target = previewTarget(item);
  return (
    <SandboxPreviewModal
      target={target}
      title={item.title}
      folder={item.folder}
      id={item.id}
      showInfo={false}
      showComponents={false}
    >
      <button
        type="button"
        disabled={!target}
        className="overflow-hidden rounded-[10px] border border-black/5 bg-nb-surface text-left shadow-sm disabled:opacity-50"
      >
        <div className="relative aspect-[1.65] bg-black">
          {item.thumbnailUrl ? (
            // biome-ignore lint/performance/noImgElement: sandbox thumbnails are served by the app
            <img
              src={resolveApiUrl(item.thumbnailUrl)}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : (
            <Film aria-hidden className="absolute inset-0 m-auto size-8 text-white/50" />
          )}
          <span className="absolute top-2 left-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-black">
            DEMO · SANDBOX
          </span>
        </div>
        <div className="px-3 py-2">
          <span className="text-xs font-semibold">{item.title}</span>
        </div>
      </button>
    </SandboxPreviewModal>
  );
}
