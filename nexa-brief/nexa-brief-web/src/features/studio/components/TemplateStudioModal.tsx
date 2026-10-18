"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import type { Template } from "@/features/templates/types";
import { MediaPlayerModal } from "@/shared/components/media/MediaPlayerModal";
import { useTemplateStudio } from "../hooks/useTemplateStudio";
import { StudioSidebar, StudioVersionToggle } from "./StudioSidebar";

type ModalProps = Omit<ComponentProps<typeof MediaPlayerModal>, "sidebar" | "source" | "actions">;

/** El modal de una plantilla con el Estudio adentro. Es un componente aparte
 * (y no un hook en TemplateCard) para que la landing, que no lo usa, no
 * dispare las queries de nichos/drafts/requisitos. */
export function TemplateStudioModal({
  template,
  defaultUrl,
  poster,
  previewVolume,
  ...modalProps
}: ModalProps & {
  template: Template;
  /** Showcase original (Por defecto). */
  defaultUrl: string | null;
  /** Portada del showcase (solo para la versión Por defecto). */
  poster?: string | null;
  previewVolume: number;
}) {
  const t = useTranslations("studio");
  const studio = useTemplateStudio(template, modalProps.open);
  // Mismos query params que el showcase: el preview del draft recibe la misma
  // inyección (controles postMessage, volumen) y oculta el botón rojo.
  const mineUrl = studio.draftPreviewUrl
    ? `${studio.draftPreviewUrl}?controls=1&volume=${previewVolume}`
    : null;
  const showingMine = studio.view === "mine" && mineUrl !== null;
  const url = showingMine ? mineUrl : defaultUrl;

  return (
    <MediaPlayerModal
      {...modalProps}
      source={url ? { kind: "iframe", url, poster: showingMine ? null : poster } : null}
      actions={<StudioVersionToggle studio={studio} />}
      sidebar={<StudioSidebar studio={studio} />}
      sidebarToggleLabel={t("toggleSidebar")}
    />
  );
}
