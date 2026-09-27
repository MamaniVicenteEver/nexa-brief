"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import type { LibraryAssetKind } from "../api/library-assets-service";
import { useLibraryAssets } from "../hooks/useLibraryAssets";

interface LibraryAssetPickerDialogProps {
  kind: LibraryAssetKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (assetId: string) => void;
}

const KIND_LABEL_KEY: Record<LibraryAssetKind, string> = {
  images: "images",
  music: "music",
  videos: "videos",
};

export function LibraryAssetPickerDialog({
  kind,
  open,
  onOpenChange,
  onSelect,
}: LibraryAssetPickerDialogProps) {
  const t = useTranslations("library");
  const { data: assets, isLoading } = useLibraryAssets(kind, open);

  function choose(assetId: string) {
    onSelect(assetId);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t(`assetPicker.title.${KIND_LABEL_KEY[kind]}`)}</DialogTitle>
        {isLoading && (
          <p className="py-6 text-center text-sm text-nb-mute">{t("assetPicker.loading")}</p>
        )}
        {!isLoading && assets?.length === 0 && (
          <p className="py-6 text-center text-sm text-nb-mute">{t("assetPicker.empty")}</p>
        )}
        <div className="grid max-h-[60vh] grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 overflow-y-auto py-1">
          {assets?.map((asset) =>
            kind === "music" ? (
              <div
                key={asset.assetId}
                className="flex flex-col gap-2 rounded-xl border border-nb-line bg-nb-surface p-3"
              >
                <span className="truncate text-xs font-semibold text-nb-ink">{asset.title}</span>
                {/** biome-ignore lint/a11y/useMediaCaption: pista de audio real, sin transcripción disponible */}
                <audio src={asset.fileUrl} controls className="h-8 w-full" />
                <button
                  type="button"
                  onClick={() => choose(asset.assetId)}
                  className="nb-btn-secondary rounded-full px-3 py-1.5 text-xs font-semibold"
                >
                  {t("assetPicker.chooseButton")}
                </button>
              </div>
            ) : (
              <button
                key={asset.assetId}
                type="button"
                onClick={() => choose(asset.assetId)}
                className="flex flex-col gap-2 rounded-xl border border-nb-line bg-nb-surface p-3 text-left transition-colors hover:border-nb-green"
              >
                {kind === "images" ? (
                  // biome-ignore lint/performance/noImgElement: URL del backend, no un asset estático de Next
                  <img
                    src={asset.fileUrl}
                    alt=""
                    className="aspect-video w-full rounded-lg object-cover"
                  />
                ) : (
                  <video
                    src={asset.fileUrl}
                    muted
                    className="aspect-video w-full rounded-lg object-cover"
                  />
                )}
                <span className="truncate text-xs font-semibold text-nb-ink">{asset.title}</span>
              </button>
            ),
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
