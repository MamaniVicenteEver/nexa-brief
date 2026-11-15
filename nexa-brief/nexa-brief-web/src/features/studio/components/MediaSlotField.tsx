"use client";

import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { resolveAssetPreviewUrl } from "@/features/library/api/library-assets-service";
import { ResourcePicker } from "@/features/resources";
import type { RequirementMediaSlot } from "@/features/templates/types";
import { cn } from "@/lib/utils";
import type { MediaAssetKind, MediaRef } from "../types";
import { FieldShell, SegmentedControl } from "./FieldShell";
import { StockSearchPanel } from "./StockSearchPanel";

type Mode = "library" | "stock";

/** Mueve un elemento de una posición a otra, sin tocar el resto del orden. */
function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function mediaFileUrl(ref: MediaRef) {
  return resolveAssetPreviewUrl(ref.kind === "image" ? "images" : "videos", ref.assetId);
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
  const [expanded, setExpanded] = useState(false);
  const pickerId = useId();
  const kinds: MediaAssetKind[] = slot.kind === "image|video" ? ["video", "image"] : [slot.kind];
  const [kind, setKind] = useState<MediaAssetKind>(kinds[0]);
  const single = slot.max <= 1;

  // Agregar respeta el máximo: en un lugar de uno solo, lo nuevo reemplaza.
  function add(ref: MediaRef) {
    if (value.some((r) => r.kind === ref.kind && r.assetId === ref.assetId)) return;
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
      <ul className="flex flex-wrap gap-1.5">
        {value.map((ref, index) => (
          <li key={`${ref.kind}-${ref.assetId}`} className="relative size-14 overflow-hidden rounded-lg bg-nb-bg-2">
            {/* biome-ignore lint/performance/noImgElement: vista previa del backend */}
            <img src={mediaFileUrl(ref)} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
            <span className="absolute top-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] font-bold text-white">{index + 1}</span>
            <button type="button" aria-label={t("remove")} onClick={() => onChange(value.filter((r) => r.kind !== ref.kind || r.assetId !== ref.assetId))} className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-black/70 text-white"><X className="size-2.5" /></button>
          <div className="absolute inset-x-0.5 bottom-0.5 flex justify-between">
            <button type="button" aria-label={t("moveEarlier")} title={t("moveEarlier")} disabled={index === 0} onClick={() => onChange(moveItem(value, index, index - 1))} className="flex size-4 items-center justify-center rounded bg-black/60 text-white disabled:opacity-30"><ChevronLeft className="size-3" /></button>
            <button type="button" aria-label={t("moveLater")} title={t("moveLater")} disabled={index === value.length - 1} onClick={() => onChange(moveItem(value, index, index + 1))} className="flex size-4 items-center justify-center rounded bg-black/60 text-white disabled:opacity-30"><ChevronRight className="size-3" /></button>
          </div>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={pickerId} aria-label={expanded ? t("closePicker") : t("openPicker")} title={expanded ? t("closePicker") : t("openPicker")} className="flex size-14 items-center justify-center rounded-lg border border-dashed border-nb-line text-nb-ink-soft hover:bg-nb-bg-2">
            <Plus className={cn("size-5 transition-transform", expanded && "rotate-45")} />
          </button>
        </li>
      </ul>
      {expanded && <div className="flex flex-wrap items-center gap-1.5">
        <SegmentedControl<Mode> value={mode} onChange={setMode} options={[{ value: "library", label: t("library") }, { value: "stock", label: t("stock") }]} />
        {kinds.length > 1 && <SegmentedControl<MediaAssetKind> value={kind} onChange={setKind} options={kinds.map((k) => ({ value: k, label: t(k === "image" ? "kindImage" : "kindVideo") }))} />}
      </div>}

      <div id={pickerId}>
        {expanded &&
          (mode === "library" ? (
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
                    .filter((id) => !kept.some((r) => r.kind === kind && r.assetId === id))
                    .map((assetId) => ({ assetId, kind }));
                  onChange([...kept, ...added].slice(0, slot.max));
                }}
              />
            )
          ) : (
            <StockSearchPanel key={kind} slot={slot} kind={kind} onImported={add} />
          ))}
      </div>
    </FieldShell>
  );
}
