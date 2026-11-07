"use client";

import { cn } from "@/lib/utils";
import type { PublishFormat } from "./brand-groups";

/** Un solo formato por cuenta: elegir 9:16 desmarca 16:9 y al revés. */
export function AccountFormatChoice({
  name,
  title,
  allowed,
  value,
  labels,
  emptyLabel,
  onChange,
}: {
  /** Nombre del grupo de radios (único por cuenta). */
  name: string;
  title: string;
  allowed: PublishFormat[];
  value: PublishFormat | null;
  labels: Record<PublishFormat, string>;
  emptyLabel: string;
  onChange: (format: PublishFormat) => void;
}) {
  return (
    <div className="mt-1 border-t border-nb-line pt-2">
      <p className="mb-1.5 text-[10.5px] text-nb-mute">{title}</p>
      {allowed.length === 0 ? (
        <p className="text-[11px] text-amber-700">{emptyLabel}</p>
      ) : (
        <div className="flex gap-1.5">
          {allowed.map((format) => (
            <label
              key={format}
              className={cn(
                "flex flex-1 cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11.5px]",
                value === format ? "border-nb-ink bg-nb-bg-2" : "border-nb-line",
              )}
            >
              <input
                type="radio"
                name={name}
                checked={value === format}
                onChange={() => onChange(format)}
                className="size-3.5 accent-black"
              />
              {labels[format]}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
