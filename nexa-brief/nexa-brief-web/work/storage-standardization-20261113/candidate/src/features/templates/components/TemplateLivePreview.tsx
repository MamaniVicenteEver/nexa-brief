"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { STAGE_LABEL_KEY } from "@/features/create-video/stage";
import type { PreviewStatus } from "../types";

export function TemplateLivePreview({
  status,
  isTriggering,
}: {
  status: PreviewStatus | undefined;
  isTriggering: boolean;
}) {
  const t = useTranslations("templates");
  const tStages = useTranslations("createVideo.stages");
  const [needsClickForAudio, setNeedsClickForAudio] = useState(true);
  const previewUrl = status?.files.find((f) => f.filename === "index.html")?.url ?? null;
  const ready = status?.isSuccess && previewUrl;

  if (!status && !isTriggering) {
    return (
      <div className="flex aspect-[9/16] w-full items-center justify-center rounded-[22px] bg-nb-ink/5 text-sm text-nb-mute md:aspect-video">
        {t("livePreview.placeholder")}
      </div>
    );
  }

  if (status?.stage === "failed") {
    return (
      <div className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 rounded-[22px] bg-destructive/5 p-6 text-center md:aspect-video">
        <p className="text-sm font-semibold text-destructive">{t("livePreview.failedTitle")}</p>
        {status.errors.map((err) => (
          <p key={err} className="text-xs text-destructive/80">
            {err}
          </p>
        ))}
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex aspect-[9/16] w-full items-center justify-center rounded-[22px] bg-nb-ink/5 text-sm text-nb-mute md:aspect-video">
        {status ? tStages(STAGE_LABEL_KEY[status.stage]) : t("livePreview.generating")}
      </div>
    );
  }

  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[22px] bg-black md:aspect-video">
      <iframe
        src={previewUrl}
        title={t("livePreview.iframeTitle")}
        allow="autoplay"
        className="size-full border-0"
      />
      {needsClickForAudio && (
        <button
          type="button"
          onClick={() => setNeedsClickForAudio(false)}
          className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-semibold text-white"
        >
          {t("livePreview.clickToPlay")}
        </button>
      )}
    </div>
  );
}
