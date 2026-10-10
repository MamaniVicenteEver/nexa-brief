"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { JobStage } from "@/features/create-video/types";
import { Link } from "@/i18n/navigation";
import type { Draft } from "../types";

// Etapas de cada fase, en orden: el preview corre hasta html_generated y el
// render retoma desde ahí (ver pipeline.run(resume=True) en el backend).
const PREVIEW_STAGES: JobStage[] = [
  "pending",
  "input_analyzed",
  "design_complete",
  "resources_fetched",
  "prompt_built",
  "html_generated",
];
const RENDER_STAGES: JobStage[] = [
  "html_generated",
  "video_recorded",
  "summary_generated",
  "packaged",
  "publishing",
  "published",
];

function fraction(stages: JobStage[], stage: JobStage) {
  const index = stages.indexOf(stage);
  return index < 0 ? 0.05 : Math.max(0.05, (index + 1) / stages.length);
}

/** Barra de progreso por etapa y estado final del draft. */
export function DraftProgress({ draft, dirty }: { draft: Draft; dirty: boolean }) {
  const t = useTranslations("studio.progress");

  if (draft.status === "previewing" || draft.status === "rendering") {
    const rendering = draft.status === "rendering";
    const value = fraction(rendering ? RENDER_STAGES : PREVIEW_STAGES, draft.stage);
    return (
      <div className="flex flex-col gap-1.5" aria-live="polite">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-nb-ink">
          <Loader2 className="size-3.5 animate-spin" />
          {rendering ? t("rendering") : t("previewing")} · {t(`stages.${draft.stage}`)}
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-nb-bg-2">
          <div
            className="h-full rounded-full bg-nb-green-dark transition-[width] duration-500"
            style={{ width: `${Math.round(value * 100)}%` }}
          />
        </div>
      </div>
    );
  }

  if (draft.status === "failed") {
    return (
      <div className="flex flex-col gap-1 rounded-xl bg-nb-accent-coral/10 p-2.5 text-[12px] text-nb-ink">
        <p className="flex items-center gap-1.5 font-semibold">
          <AlertTriangle className="size-3.5 text-nb-accent-coral" />
          {draft.recoverable ? t("failedRecoverable") : t("failed")}
        </p>
        {draft.errors.length > 0 && (
          <p className="line-clamp-3 text-[11px] text-nb-ink-soft">{draft.errors.at(-1)}</p>
        )}
      </div>
    );
  }

  if (draft.status === "rendered") {
    return (
      <div className="flex flex-col gap-1.5 rounded-xl bg-nb-green/25 p-2.5 text-[12px] text-nb-ink">
        <p className="flex items-center gap-1.5 font-semibold">
          <CheckCircle2 className="size-3.5 text-nb-green-dark" />
          {t("rendered")}
        </p>
        {draft.jobId && (
          <Link
            href={`/biblioteca/${draft.jobId}`}
            className="w-fit font-semibold text-nb-green-dark underline"
          >
            {t("openLibrary")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-nb-ink">
      <CheckCircle2 className="size-3.5 text-nb-green-dark" />
      {dirty ? t("changed") : t("ready")}
    </p>
  );
}
