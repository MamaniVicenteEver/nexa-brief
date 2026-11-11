"use client";

import { Check, Music } from "lucide-react";
import type { LibraryAsset } from "@/features/library/api/library-assets-service";
import { cn } from "@/lib/utils";
import { formatDuration } from "../kinds";
import { TranscriptionBadge } from "./TranscriptionBadge";

/** The same audio choice in the library and the selected-song summary. */
export function AudioResourceOption({
  asset,
  selected,
  onClick,
}: {
  asset: LibraryAsset;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border bg-nb-surface p-2.5 text-left transition-colors",
        selected
          ? "border-nb-green-dark ring-2 ring-nb-green"
          : "border-nb-line hover:border-nb-green-dark",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-nb-bg-2">
        <Music className="size-4 text-nb-mute" />
      </span>
      <span className="min-w-0 flex-1 pr-4">
        <span
          className="block truncate text-[12.5px] font-semibold text-nb-ink"
          title={asset.title}
        >
          {asset.title}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-nb-mute">
          {formatDuration(asset.durationSeconds)}
          {asset.kind === "music" && (
            <TranscriptionBadge
              status={asset.transcriptionStatus}
              error={asset.transcriptionError}
            />
          )}
        </span>
      </span>
      {selected && (
        <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-nb-green-dark text-white">
          <Check className="size-3" />
        </span>
      )}
    </button>
  );
}
