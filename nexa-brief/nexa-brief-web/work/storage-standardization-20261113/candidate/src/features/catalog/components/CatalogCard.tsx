"use client";

import { useTranslations } from "next-intl";
import { lazy, Suspense, useState } from "react";
import { MediaPlayerModal } from "@/shared/components/media/MediaPlayerModal";
import { playbackSource } from "../playback";
import type { CatalogEntry } from "../types";

const InternalCatalogPlayer = lazy(() =>
  import("./InternalCatalogPlayer").then((module) => ({ default: module.InternalCatalogPlayer })),
);

export function CatalogCard({
  item,
  internal = false,
}: {
  item: CatalogEntry;
  internal?: boolean;
}) {
  const t = useTranslations("catalog");
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const trigger = (
    <button
      type="button"
      aria-label={t("play", { title: item.title })}
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-nb-line bg-nb-surface text-left"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-nb-bg-2">
        {item.poster_url && !imageFailed ? (
          // biome-ignore lint/performance/noImgElement: streaming API image; no Next optimization required.
          <img
            src={item.poster_url}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center px-4 text-center text-sm text-nb-mute">
            {item.title}
          </div>
        )}
        <span className="absolute top-2 left-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-black">
          DEMO
        </span>
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-3xl text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          ▶
        </span>
      </div>
      <p className="w-full truncate p-3 text-xs font-semibold">{item.title}</p>
    </button>
  );
  const source = playbackSource(item);
  return internal ? (
    <Suspense fallback={null}>
      <InternalCatalogPlayer
        item={item}
        source={source}
        open={open}
        onOpenChange={setOpen}
        trigger={trigger}
      />
    </Suspense>
  ) : (
    <MediaPlayerModal
      title={item.title}
      source={source}
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      defaultVolume={0.05}
      defaultViewport={item.orientation === "9:16" ? "mobile" : "desktop"}
    />
  );
}
