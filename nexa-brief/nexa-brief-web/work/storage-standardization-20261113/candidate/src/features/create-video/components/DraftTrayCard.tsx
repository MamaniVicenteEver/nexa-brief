"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useDraft } from "@/features/studio";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/shared/components/ui/progress-bar";
import { useJobsTrayStore } from "@/shared/store";
import { useNicheName } from "../hooks/useNicheName";
import { STAGE_LABEL_KEY } from "../stage";
import { type TrackedDraft, useDraftsTrayStore } from "../store/drafts-tray-store";
import type { JobStage } from "../types";

/** Etapas que corre el preview del draft, en orden: alcanza para mostrar
 * cuánto le falta antes de que arranque el grabado (que ya tiene % real). */
const PREVIEW_STAGES: JobStage[] = [
  "pending",
  "input_analyzed",
  "design_complete",
  "resources_fetched",
  "prompt_built",
  "html_generated",
];

/** Un video de "Crear video" mientras se previsualiza. Apenas el draft tiene
 * job_id (empezó a grabarse) lo pasa a la bandeja de jobs, que muestra el
 * progreso real del grabado, y se quita de la de drafts. */
export function DraftTrayCard({
  tracked,
  actions,
}: {
  tracked: TrackedDraft;
  actions?: React.ReactNode;
}) {
  const t = useTranslations("createFlow.tray");
  const tStages = useTranslations("createVideo.stages");
  const { data: draft, isError } = useDraft(tracked.draftId);
  const name = useNicheName(tracked.category);
  const addJobs = useJobsTrayStore((state) => state.addJobs);
  const removeDraft = useDraftsTrayStore((state) => state.removeDraft);

  useEffect(() => {
    if (draft?.jobId) {
      addJobs([{ jobId: draft.jobId, category: tracked.category }]);
      removeDraft(tracked.draftId);
    }
  }, [draft?.jobId, tracked, addJobs, removeDraft]);

  const failed = isError || draft?.status === "failed";
  const stageIndex = draft ? PREVIEW_STAGES.indexOf(draft.stage) : -1;
  const percent = stageIndex >= 0 ? ((stageIndex + 1) / PREVIEW_STAGES.length) * 100 : null;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border p-3.5 shadow-[0_12px_28px_-14px_rgba(40,30,10,0.35)]",
        failed ? "border-red-500/30 bg-red-500/5" : "border-nb-line bg-nb-surface",
      )}
    >
      <div className="relative flex flex-col gap-2.5">
        <header className="flex items-center gap-2 pr-6">
          <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-nb-ink">{name}</h3>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
              failed ? "bg-red-600 text-white" : "bg-nb-green/40 text-nb-green-dark",
            )}
          >
            {failed ? t("failed") : t("preparing")}
          </span>
        </header>
        {actions && <div className="absolute -top-1 -right-1">{actions}</div>}

        {!failed && (
          <>
            <p className="text-[12px] font-semibold text-nb-ink-soft">
              {draft ? tStages(STAGE_LABEL_KEY[draft.stage] ?? "pending") : t("starting")}
              <span className="font-normal text-nb-mute">{` · ${t("previewHint")}`}</span>
            </p>
            <ProgressBar value={percent} label={t("barLabel", { name })} />
          </>
        )}

        {failed &&
          (draft?.errors.length ? draft.errors : [t("failedHint")]).map((err) => (
            <p key={err} className="line-clamp-3 text-[11.5px] text-red-700">
              {err}
            </p>
          ))}
      </div>
    </article>
  );
}
