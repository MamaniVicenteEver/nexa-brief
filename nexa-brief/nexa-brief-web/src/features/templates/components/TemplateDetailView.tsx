"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ResourceSelection } from "@/shared/lib/resource-source";
import type { TemplatePreviewSelections } from "../api/templates-service";
import { useTemplate } from "../hooks/useTemplate";
import { useTemplatePreview } from "../hooks/useTemplatePreview";
import { ResourcePickerSection } from "./ResourcePickerSection";
import { TemplateLivePreview } from "./TemplateLivePreview";
import { TemplateRecordButton } from "./TemplateRecordButton";

export function TemplateDetailView({ templateId }: { templateId: string }) {
  const t = useTranslations("templates");
  const { data: template, isLoading } = useTemplate(templateId);
  const { triggerPreview, isTriggering, status } = useTemplatePreview(templateId);

  const [image, setImage] = useState<ResourceSelection | undefined>(undefined);
  const [music, setMusic] = useState<ResourceSelection | undefined>(undefined);
  const [video, setVideo] = useState<ResourceSelection | undefined>(undefined);

  if (isLoading) {
    return <p className="px-10 pt-22 text-sm text-nb-mute">{t("detail.loading")}</p>;
  }
  if (!template) {
    return <p className="px-10 pt-22 text-sm text-nb-mute">{t("detail.notFound")}</p>;
  }

  const selections: TemplatePreviewSelections = { image, music, video };

  function onGeneratePreview() {
    triggerPreview(selections);
  }

  return (
    <>
      <div className="mx-auto max-w-[1280px] px-10 pt-22 pb-4.5">
        <h1 className="font-nb-sans text-[clamp(20px,2.4vw,26px)] font-extrabold tracking-[-0.02em] text-nb-ink">
          {template.displayName}
        </h1>
      </div>

      <div className="relative z-5 grid grid-cols-1 gap-7 px-[5%] pb-27.5 lg:grid-cols-[8fr_2fr] lg:gap-0">
        <div>
          <TemplateLivePreview status={status} isTriggering={isTriggering} />
        </div>

        <div className="flex flex-col gap-5.5 lg:ml-6">
          {template.requiresImage && !template.requiresVideo && (
            <ResourcePickerSection
              label={t("detail.imageLabel")}
              kind="images"
              accept="image/*"
              selection={image}
              onChange={setImage}
            />
          )}
          {template.requiresVideo && (
            <ResourcePickerSection
              label={t("detail.videoLabel")}
              kind="videos"
              accept="video/*"
              selection={video}
              onChange={setVideo}
            />
          )}
          <ResourcePickerSection
            label={t("detail.musicLabel")}
            kind="music"
            accept="audio/*"
            selection={music}
            onChange={setMusic}
          />

          <button
            type="button"
            onClick={onGeneratePreview}
            disabled={isTriggering}
            className="nb-btn-secondary rounded-full px-4 py-2.5 text-sm font-semibold disabled:pointer-events-none disabled:opacity-60"
          >
            {isTriggering ? t("detail.generatingPreview") : t("detail.generatePreview")}
          </button>

          <TemplateRecordButton
            template={template}
            selections={selections}
            canRecord={Boolean(status?.isSuccess)}
          />
        </div>
      </div>
    </>
  );
}
