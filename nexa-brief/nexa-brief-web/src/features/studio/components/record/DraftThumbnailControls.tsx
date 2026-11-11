"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { DraftThumbnailEditor } from "../../hooks/useDraftThumbnailEditor";

export function DraftThumbnailControls({
  editor,
  disabled,
}: {
  editor: DraftThumbnailEditor;
  disabled: boolean;
}) {
  const t = useTranslations("studio.thumbnails");
  const design = editor.options[editor.editingOption].design ?? {};
  const bg = (design.background ?? {}) as Record<string, unknown>;
  const sourceKind = String(bg.sourceKind ?? "none");
  const kind = bg.kind === "frame" && sourceKind === "none" ? "solid" : String(bg.kind ?? "frame");
  const [time, setTime] = useState(String(bg.time ?? 12));
  // biome-ignore lint/correctness/useExhaustiveDependencies: switching options also discards an unfinished time input.
  useEffect(() => {
    setTime(String(bg.time ?? 12));
  }, [bg.time, editor.editingOption]);
  const validTime =
    time !== "" && Number.isFinite(Number(time)) && Number(time) >= 0 && Number(time) <= 86400;
  const update = (patch: Record<string, unknown>) =>
    editor.setDesign({
      background: { ...bg, ...patch, ...("overlay" in patch ? { overlayMode: "manual" } : {}) },
    });
  // Esperar a que termine de escribir evita extraer un fotograma por cada dígito.
  useEffect(() => {
    if (
      disabled ||
      editor.isUploading ||
      kind !== "frame" ||
      sourceKind !== "video" ||
      !validTime ||
      Number(time) === Number(bg.time ?? 12)
    )
      return;
    const timer = setTimeout(
      () => editor.setDesign({ background: { ...bg, kind: "frame", time: Number(time) } }),
      700,
    );
    return () => clearTimeout(timer);
  }, [time, bg, kind, sourceKind, validTime, editor.setDesign, editor.isUploading, disabled]);
  const inputClass =
    "min-w-0 rounded-lg border border-nb-line bg-nb-surface px-2 py-1.5 text-[11px] text-nb-ink";
  return (
    <details className="rounded-xl border border-nb-line text-[11px]">
      <summary className="cursor-pointer px-3 py-2.5 font-semibold text-nb-ink">
        {t("background")}
      </summary>
      <fieldset
        disabled={disabled || editor.isUploading}
        className="flex flex-col gap-2 px-2.5 pb-2.5 disabled:opacity-60"
      >
        <select
          aria-label={t("background")}
          value={kind}
          onChange={(event) => update({ kind: event.target.value })}
          className={inputClass}
        >
          {sourceKind !== "none" && (
            <option value="frame">{t(sourceKind === "video" ? "frame" : "templateImage")}</option>
          )}
          {bg.asset ? <option value="image">{t("image")}</option> : null}
          <option value="solid">{t("solid")}</option>
        </select>
        {kind === "frame" && sourceKind === "video" && (
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-nb-mute">
              {t("frameTime")}
              <input
                type="number"
                min="0"
                max="86400"
                step="0.1"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className={inputClass}
              />
            </label>
            <button
              type="button"
              disabled={!validTime}
              onClick={() => update({ kind: "frame", time: Number(time) })}
              className="rounded-lg bg-nb-ink px-2 py-2 font-semibold text-nb-surface disabled:opacity-50"
            >
              {t("applyFrame")}
            </button>
          </div>
        )}
        <label className="flex cursor-pointer flex-col gap-1.5 text-nb-ink">
          {t(editor.isUploading ? "uploadingImage" : "changeThumbnail")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={t("uploadImage")}
            className="peer sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void editor.uploadBackground(file).catch(() => undefined);
              event.target.value = "";
            }}
          />
          <span className="self-start rounded-lg bg-nb-ink px-3 py-2 font-semibold text-nb-surface transition-opacity hover:opacity-85 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:cursor-not-allowed">
            {t(editor.isUploading ? "uploadingImage" : "selectImage")}
          </span>
        </label>
        {kind !== "solid" && (
          <>
            <label className="flex flex-wrap items-center gap-2 text-nb-mute">
              <span>{t("darken")}</span>
              <input
                aria-label={t("darken")}
                type="range"
                min="0"
                max="0.85"
                step="0.05"
                value={Number(bg.overlay ?? 0.2)}
                onChange={(event) => update({ overlay: Number(event.target.value) })}
                className="min-w-0 flex-1 accent-nb-ink"
              />
              <output className="w-8 text-right tabular-nums text-nb-ink">
                {Math.round(Number(bg.overlay ?? 0.2) * 100)}%
              </output>
            </label>
            <p className="text-[10px] text-nb-mute">{t("originalColors")}</p>
            <label className="flex items-center justify-between gap-2 text-nb-mute">
              {t("position")}
              <select
                value={Number(bg.x ?? 0.5)}
                onChange={(event) => update({ x: Number(event.target.value) })}
                className={inputClass}
              >
                <option value="0">{t("left")}</option>
                <option value="0.5">{t("center")}</option>
                <option value="1">{t("right")}</option>
              </select>
            </label>
          </>
        )}
        <p className="text-nb-mute">
          {t("letterSubtitle", { percent: editor.editingOption === "A" ? 24.3 : 30 })}
        </p>
      </fieldset>
    </details>
  );
}
