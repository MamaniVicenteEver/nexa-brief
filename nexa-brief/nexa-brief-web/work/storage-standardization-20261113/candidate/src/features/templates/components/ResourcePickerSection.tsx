"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { LibraryAssetKind } from "@/features/library/api/library-assets-service";
import { LibraryAssetPickerDialog } from "@/features/library/components/LibraryAssetPickerDialog";
import type { ResourceSelection } from "@/shared/lib/resource-source";

interface ResourcePickerSectionProps {
  label: string;
  kind: LibraryAssetKind;
  accept: string;
  selection: ResourceSelection | undefined;
  onChange: (selection: ResourceSelection | undefined) => void;
}

export function ResourcePickerSection({
  label,
  kind,
  accept,
  selection,
  onChange,
}: ResourcePickerSectionProps) {
  const t = useTranslations("templates");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const summary =
    selection?.mode === "upload"
      ? selection.file.name
      : selection?.mode === "library"
        ? t("resourcePicker.library", { assetId: selection.assetId })
        : t("resourcePicker.auto");

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13.5px] font-bold tracking-[-0.01em] text-nb-ink">{label}</span>
      <div className="rounded-2xl border border-dashed border-nb-line bg-nb-surface p-3.5">
        <p className="truncate text-xs text-nb-mute">{summary}</p>
        {localPreviewUrl && kind === "images" && (
          // biome-ignore lint/performance/noImgElement: preview local vía blob URL
          <img src={localPreviewUrl} alt="" className="mt-2 h-20 rounded-lg object-cover" />
        )}
        <div className="mt-2.5 flex flex-wrap gap-2">
          <label className="nb-btn-secondary cursor-pointer rounded-full px-3.5 py-2 text-xs font-semibold">
            {t("resourcePicker.uploadNew")}
            <input
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setLocalPreviewUrl(kind === "images" ? URL.createObjectURL(file) : null);
                onChange({ mode: "upload", file });
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="nb-btn-secondary rounded-full px-3.5 py-2 text-xs font-semibold"
          >
            {t("resourcePicker.chooseFromLibrary")}
          </button>
          {selection && (
            <button
              type="button"
              onClick={() => {
                setLocalPreviewUrl(null);
                onChange(undefined);
              }}
              className="rounded-full px-3.5 py-2 text-xs font-semibold text-nb-ink-soft"
            >
              {t("resourcePicker.remove")}
            </button>
          )}
        </div>
      </div>
      <LibraryAssetPickerDialog
        kind={kind}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(assetId) => {
          setLocalPreviewUrl(null);
          onChange({ mode: "library", assetId });
        }}
      />
    </div>
  );
}
