"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ResourcePicker } from "@/features/resources";
import type { RequirementMediaSlot } from "@/features/templates/types";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { cn } from "@/lib/utils";
import type { MediaAssetKind, MediaRef } from "../types";
import { FieldShell, SegmentedControl } from "./FieldShell";
import { StockSearchPanel } from "./StockSearchPanel";

type Mode = "library" | "stock";

export function mediaFileUrl(ref: MediaRef) {
  return resolveApiUrl(
    `/api/v1/library/${ref.kind === "image" ? "images" : "videos"}/${ref.assetId}/file`,
  );
}

/** Un lugar de medios: lo elegido arriba (en orden, que es el orden en que la
 * plantilla los usa) y abajo de dónde sacarlo — librería (con subida) o stock. */
export function MediaSlotField({
  slot,
  value,
  onChange,
}: {
  slot: RequirementMediaSlot;
  value: MediaRef[];
  onChange: (next: MediaRef[]) => void;
}) {
  const t = useTranslations("studio.media");
  const [mode, setMode] = useState<Mode>("library");
  const kinds: MediaAssetKind[] = slot.kind === "image|video" ? ["video", "image"] : [slot.kind];
  const [kind, setKind] = useState<MediaAssetKind>(kinds[0]);
  const single = slot.max <= 1;

  // Agregar respeta el máximo: en un lugar de uno solo, lo nuevo reemplaza.
  function add(ref: MediaRef) {
    if (value.some((r) => r.assetId === ref.assetId)) return;
    onChange(single ? [ref] : [...value, ref].slice(0, slot.max));
  }

  const ofKind = value.filter((r) => r.kind === kind);
  const others = value.filter((r) => r.kind !== kind);

  return (
    <FieldShell
      title={slot.label || slot.slot}
      hint={slot.hint}
      badge={
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
            value.length < slot.min
              ? "bg-nb-accent-amber/25 text-nb-ink"
              : "bg-nb-bg-2 text-nb-ink-soft",
          )}
        >
          {slot.min === slot.max
            ? `${value.length}/${slot.max}`
            : t("count", { n: value.length, min: slot.min, max: slot.max })}
        </span>
      }
    >
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((ref, index) => (
            <li
              key={ref.assetId}
              className="relative size-14 overflow-hidden rounded-lg bg-nb-bg-2"
            >
              {ref.kind === "image" ? (
                // biome-ignore lint/performance/noImgElement: archivo servido por el backend
                <img src={mediaFileUrl(ref)} alt="" className="size-full object-cover" />
              ) : (
                <video
                  src={`${mediaFileUrl(ref)}#t=0.5`}
                  muted
                  preload="metadata"
                  className="size-full object-cover"
                />
              )}
              <span className="absolute top-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] font-bold text-white">
                {index + 1}
              </span>
              <button
                type="button"
                aria-label={t("remove")}
                onClick={() => onChange(value.filter((r) => r.assetId !== ref.assetId))}
                className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-black/70 text-white"
              >
                <X className="size-2.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "library", label: t("library") },
            { value: "stock", label: t("stock") },
          ]}
        />
        {kinds.length > 1 && (
          <SegmentedControl<MediaAssetKind>
            value={kind}
            onChange={setKind}
            options={kinds.map((k) => ({
              value: k,
              label: t(k === "image" ? "kindImage" : "kindVideo"),
            }))}
          />
        )}
      </div>

      {mode === "library" ? (
        single ? (
          <ResourcePicker
            key={kind}
            kind={kind}
            allowUpload
            value={ofKind[0]?.assetId ?? null}
            onChange={(id) => onChange(id ? [{ assetId: id, kind }] : others)}
          />
        ) : (
          <ResourcePicker
            key={kind}
            kind={kind}
            multiple
            allowUpload
            value={ofKind.map((r) => r.assetId)}
            onChange={(ids) => {
              // Conserva el orden de lo ya elegido y agrega lo nuevo al final.
              const kept = value.filter((r) => r.kind !== kind || ids.includes(r.assetId));
              const added = ids
                .filter((id) => !kept.some((r) => r.assetId === id))
                .map((assetId) => ({ assetId, kind }));
              onChange([...kept, ...added].slice(0, slot.max));
            }}
          />
        )
      ) : (
        <StockSearchPanel key={kind} slot={slot} kind={kind} onImported={add} />
      )}
    </FieldShell>
  );
}
