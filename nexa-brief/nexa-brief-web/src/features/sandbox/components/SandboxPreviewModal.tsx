"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useState } from "react";
import { resolveApiUrl } from "@/infrastructure/api/http-client";
import { MediaPlayerModal, type MediaSource } from "@/shared/components/media/MediaPlayerModal";
import { useSandboxInfo } from "../hooks/useSandboxInfo";
import { SandboxComponentsPicker } from "./SandboxComponentsPicker";
import { SandboxInfoSidebar } from "./SandboxInfoSidebar";

export function SandboxPreviewModal({
  target,
  title,
  folder,
  id,
  showInfo = true,
  showComponents = true,
  children,
}: {
  target: MediaSource | null;
  title: string;
  folder: string;
  id: string;
  showInfo?: boolean;
  showComponents?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("sandbox");
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const info = useSandboxInfo(folder, id, open && showInfo);

  if (!target) return children;

  const components = info.data?.info?.components;

  const source: MediaSource =
    target.kind === "iframe"
      ? {
          ...target,
          url: previewUrl ?? resolveApiUrl(target.url),
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
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPreviewUrl(null);
      }}
      title={title}
      description={t("previewHint")}
      source={source}
      trigger={children}
      sidebar={
        showInfo ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {showComponents &&
              open &&
              target.kind === "iframe" &&
              components &&
              components.length > 0 && (
                <SandboxComponentsPicker
                  key={`${folder}:${id}`}
                  folder={folder}
                  id={id}
                  components={components}
                  onPreview={setPreviewUrl}
                />
              )}
            <SandboxInfoSidebar
              title={title}
              data={info.data}
              isLoading={info.isLoading}
              isError={info.isError}
            />
          </div>
        ) : undefined
      }
      sidebarToggleLabel={t("info.toggleSidebar")}
    />
  );
}
