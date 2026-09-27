import { isTerminalStage } from "../stage";
import type { JobDetail, JobProgressStatus, JobStage } from "../types";

/** Everything a progress UI needs, derived from the job detail + live progress. */
export interface JobProgressView {
  status: JobProgressStatus;
  /** 0-100, or null when unknown (show an indeterminate bar). */
  percent: number | null;
  /** Running pipeline step (i18n key under `createVideo.steps`), null when not running. */
  step: string | null;
  stepIndex: number;
  stepCount: number;
  stepPercent: number | null;
  queuePosition: number | null;
  etaSeconds: number | null;
}

const PUBLISHING_STAGES: JobStage[] = ["publishing"];

export function deriveJobProgress(
  detail: JobDetail | undefined,
  fallbackStage: JobStage,
): JobProgressView {
  const stage = detail?.stage ?? fallbackStage;
  const progress = detail?.progress ?? null;
  const base = {
    step: null,
    stepIndex: progress?.stepIndex ?? 0,
    stepCount: progress?.stepCount ?? 0,
    stepPercent: null,
    queuePosition: null,
    etaSeconds: null,
  };

  if (stage === "failed") return { ...base, status: "failed", percent: progress?.percent ?? null };
  if (detail?.isSuccess || (isTerminalStage(stage) && !PUBLISHING_STAGES.includes(stage))) {
    return { ...base, status: "done", percent: 100 };
  }
  if (!progress) {
    // Server restarted or the socket hasn't delivered progress yet.
    return { ...base, status: stage === "pending" ? "queued" : "running", percent: null };
  }
  return {
    status: progress.status,
    percent: progress.status === "queued" ? 0 : progress.percent,
    step: progress.step,
    stepIndex: progress.stepIndex,
    stepCount: progress.stepCount,
    stepPercent: progress.stepPercent,
    queuePosition: progress.queuePosition,
    etaSeconds: progress.etaSeconds,
  };
}

/** Rounded, human-friendly remaining time: "45 s", "3 min", "1 h 10 min". */
export function formatEta(seconds: number): {
  unit: "seconds" | "minutes" | "hours";
  value: number;
  minutes: number;
} {
  if (seconds < 60)
    return { unit: "seconds", value: Math.max(5, Math.round(seconds / 5) * 5), minutes: 0 };
  if (seconds < 3600) return { unit: "minutes", value: Math.ceil(seconds / 60), minutes: 0 };
  return {
    unit: "hours",
    value: Math.floor(seconds / 3600),
    minutes: Math.round((seconds % 3600) / 60),
  };
}
