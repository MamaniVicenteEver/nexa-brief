"use client";

import { useTranslations } from "next-intl";
import { useCreateVideoMutation } from "@/features/create-video/hooks/useCreateVideoMutation";
import type { CreateVideoFormValues } from "@/features/create-video/schema";
import type { ResourceSelection } from "@/shared/lib/resource-source";
import { useJobsTrayStore } from "@/shared/store";
import type { TemplatePreviewSelections } from "../api/templates-service";
import type { Template } from "../types";

function toFileAndAssetId(selection: ResourceSelection | undefined) {
  return {
    file: selection?.mode === "upload" ? selection.file : undefined,
    assetId: selection?.mode === "library" ? selection.assetId : undefined,
  };
}

export function TemplateRecordButton({
  template,
  selections,
  canRecord,
}: {
  template: Template;
  selections: TemplatePreviewSelections;
  canRecord: boolean;
}) {
  const t = useTranslations("templates");
  const { mutate, isPending } = useCreateVideoMutation();
  const addJobs = useJobsTrayStore((state) => state.addJobs);

  function onRecord() {
    const image = toFileAndAssetId(selections.image);
    const music = toFileAndAssetId(selections.music);
    const video = toFileAndAssetId(selections.video);

    const values: CreateVideoFormValues = {
      categoryName: template.nicheId,
      quantity: 1,
      durationMode: "auto",
      repeatCount: 1,
      imageFile: image.file,
      imageAssetId: image.assetId,
      musicFile: music.file,
      musicAssetId: music.assetId,
      videoFile: video.file,
      videoAssetId: video.assetId,
      publishingAccounts: [],
    };

    mutate(values, {
      onSuccess: (jobs) =>
        addJobs(jobs.map((job) => ({ jobId: job.jobId, category: job.category }))),
    });
  }

  return (
    <button
      type="button"
      onClick={onRecord}
      disabled={!canRecord || isPending}
      title={canRecord ? undefined : t("recordButton.tooltip")}
      className="nb-btn-pill px-5 py-3 text-sm font-semibold disabled:pointer-events-none disabled:opacity-60"
    >
      {isPending ? t("recordButton.sending") : t("recordButton.record")}
    </button>
  );
}
