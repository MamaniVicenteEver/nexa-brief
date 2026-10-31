"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useState } from "react";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { MediaPlayerModal, type MediaSource } from "@/shared/components/media/MediaPlayerModal";
import { useSandboxInfo } from "../hooks/useSandboxInfo";
import { SandboxInfoSidebar } from "./SandboxInfoSidebar";

export function SandboxPreviewModal({
  target,
  title,
  folder,
  id,
  showInfo = true,
  children,
}: {
  target: MediaSource | null;
  title: string;
  folder: string;
  id: string;
  showInfo?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("sandbox");
  const [open, setOpen] = useState(false);
  const info = useSandboxInfo(folder, id, open && showInfo);

  if (!target) return children;

  const source: MediaSource =
    target.kind === "iframe"
      ? {
          ...target,
          url: resolveApiUrl(target.url),
          poster: target.poster ? resolveApiUrl(target.poster) : null,
        }
      : {
          ...target,
          desktopUrl: target.desktopUrl ? resolveApiUrl(target.desktopUrl) : null,
          mobileUrl: target.mobileUrl ? resolveApiUrl(target.mobileUrl) : null,
        };

  return (
    <MediaPlayerModal
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={t("previewHint")}
      source={source}
      trigger={children}
      sidebar={
        showInfo ? (
          <SandboxInfoSidebar
            title={title}
            data={info.data}
            isLoading={info.isLoading}
            isError={info.isError}
          />
        ) : undefined
      }
      sidebarToggleLabel={t("info.toggleSidebar")}
    />
  );
}
