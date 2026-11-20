"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { ExplainerStudioSidebar } from "@/features/explainer/components/ExplainerStudioSidebar";
import { ThumbnailArtwork } from "@/features/explainer/components/ThumbnailArtwork";
import type { ThumbnailPreview } from "@/features/explainer/types";
import { TemplateStudioModal } from "@/features/studio/components/TemplateStudioModal";
import { MediaPlayerModal, type MediaSource } from "@/shared/components/media/MediaPlayerModal";
import { catalogService } from "../service";
import type { CatalogEntry } from "../types";

export function InternalCatalogPlayer({
  item,
  source,
  open,
  onOpenChange,
  trigger,
}: {
  item: CatalogEntry;
  source: MediaSource | null;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  trigger: ReactNode;
}) {
  const t = useTranslations("catalog");
  const [thumbnailPreview, setThumbnailPreview] = useState<ThumbnailPreview | null>(null);
  const detail = useQuery({
    queryKey: ["catalog", "studio", item.id],
    queryFn: ({ signal }) => catalogService.studio(item.id, signal),
    enabled: open,
    staleTime: 30_000,
  });
  if (detail.data?.kind === "template") {
    return (
      <TemplateStudioModal
        template={detail.data.template}
        open={open}
        onOpenChange={onOpenChange}
        title={item.title}
        trigger={trigger}
        defaultUrl={item.playback.engine_url}
        defaultSource={source}
        poster={item.poster_url}
        previewVolume={0.05}
      />
    );
  }
  const data = detail.data;
  const sidebar =
    data?.kind === "demo" ? (
      <ExplainerStudioSidebar
        video={data.video}
        thumbnailPreview={thumbnailPreview}
        onThumbnailPreview={setThumbnailPreview}
      />
    ) : (
      <p className="p-4 text-sm">{t(detail.isError ? "error" : "loading")}</p>
    );
  return (
    <MediaPlayerModal
      title={item.title}
      source={source}
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      defaultVolume={0.05}
      sidebar={open ? sidebar : undefined}
      sidebarToggleLabel={t("information")}
      defaultViewport={item.orientation === "9:16" ? "mobile" : "desktop"}
      stagePreview={
        thumbnailPreview && !thumbnailPreview.componentPreviewUrl ? (
          <ThumbnailArtwork preview={thumbnailPreview} imagePendingLabel={t("loading")} />
        ) : undefined
      }
      onCloseStagePreview={() => setThumbnailPreview(null)}
    />
  );
}
