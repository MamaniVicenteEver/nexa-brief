"use client";

import { useTranslations } from "next-intl";
import { type ComponentProps, useEffect, useState } from "react";
import { ResourceScopeProvider } from "@/features/resources/ResourceScope";
import type { Template } from "@/features/templates/types";
import { MediaPlayerModal, type MediaSource } from "@/shared/components/media/MediaPlayerModal";
import { useTemplateStudio } from "../hooks/useTemplateStudio";
import { backgroundVisibility as localBackgroundVisibility, supportsBackgroundVisibility } from "../services/background-visibility";
import { DraftThumbnailArtwork } from "./record/DraftThumbnailArtwork";
import { StudioSidebar, StudioVersionToggle } from "./StudioSidebar";
import { ThumbnailStageContext, type ThumbnailStagePreview } from "./ThumbnailStageContext";

type ModalProps = Omit<ComponentProps<typeof MediaPlayerModal>, "sidebar" | "source" | "actions">;

/** El modal de una plantilla con el Estudio adentro. Es un componente aparte
 * (y no un hook en TemplateCard) para que la landing, que no lo usa, no
 * dispare las queries de nichos/drafts/requisitos. */
export function TemplateStudioModal({
  template,
  defaultUrl,
  poster,
  previewVolume,
  defaultSource,
  ...modalProps
}: ModalProps & {
  template: Template;
  /** Showcase original (Por defecto). */
  defaultUrl: string | null;
  /** Portada del showcase (solo para la versión Por defecto). */
  poster?: string | null;
  previewVolume: number;
  defaultSource?: MediaSource | null;
}) {
  const t = useTranslations("studio");
  const studio = useTemplateStudio(template, modalProps.open);
  const [preview, setPreview] = useState<ThumbnailStagePreview | null>(null);
  useEffect(() => {
    setPreview(null);
  }, [modalProps.open, studio.tab, studio.editing, studio.recorder.choice]);
  // Mismos query params que el showcase: el preview del draft recibe la misma
  // inyección (controles postMessage, volumen) y oculta el botón rojo.
  const mineUrl = studio.draftPreviewUrl
    ? `${studio.draftPreviewUrl}?controls=1&volume=${previewVolume}&play=${studio.previewPlaybackRequest}`
    : null;
  const showingMine = studio.view === "mine" && mineUrl !== null;
  const url = showingMine ? mineUrl : defaultUrl;
  // La misma elección local acompaña al prototipo en el editor y al grabarlo.
  const displayedDraft = studio.tab === "record" ? studio.recorder.selected :
    studio.tab === "sandbox" ? (studio.editor.draft ?? studio.prototypes.find((d) => d.previewUrl === studio.draftPreviewUrl)) : null;
  const hasBackground = displayedDraft && !displayedDraft.original &&
    (displayedDraft.inputs.templateInputs?.media?.background?.length || displayedDraft.inputs.imageAssetId || displayedDraft.inputs.videoAssetId);
  const backgroundVisibility = showingMine && supportsBackgroundVisibility(template.id) && displayedDraft && hasBackground
    ? { value: studio.editing && studio.editor.draft?.draftId === displayedDraft.draftId
        ? (studio.editor.value.mediaOpacity?.background ?? 0.8)
        : (localBackgroundVisibility.get(displayedDraft.draftId) ?? 0.8), templateId: template.id }
    : undefined;

  return (
    <ResourceScopeProvider
      scope={{
        categoryId: studio.requirements.data?.resourceContext?.categoryId,
        templateId: template.id,
      }}
    >
      <ThumbnailStageContext.Provider value={{ preview, setPreview }}>
        <MediaPlayerModal
          {...modalProps}
          source={
            !showingMine && defaultSource
              ? defaultSource
              : url
                ? { kind: "iframe", url, poster: showingMine ? null : poster }
                : null
          }
          backgroundVisibility={backgroundVisibility}
          actions={<StudioVersionToggle studio={studio} />}
          sidebar={<StudioSidebar studio={studio} />}
          sidebarToggleLabel={t("toggleSidebar")}
          stagePreview={
            preview && (
              <DraftThumbnailArtwork
                manifest={preview.manifest}
                option={preview.option}
                className="max-w-full max-h-full"
              />
            )
          }
          onCloseStagePreview={() => setPreview(null)}
        />
      </ThumbnailStageContext.Provider>
    </ResourceScopeProvider>
  );
}
