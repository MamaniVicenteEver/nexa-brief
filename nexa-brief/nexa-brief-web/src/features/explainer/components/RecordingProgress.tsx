"use client";

import { useTranslations } from "next-intl";
import type { ExplainerJob } from "../types";

function formatRemaining(seconds: number): string {
  const value = Math.max(0, Math.round(seconds));
  if (value < 60) return `${value} s`;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  if (hours) return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
  return remainder ? `${minutes} min ${remainder} s` : `${minutes} min`;
}

export function RecordingProgress({ job }: { job: ExplainerJob }) {
  const t = useTranslations("explainer.tray");
  const tp = useTranslations("templates");
  const percent = Math.min(100, Math.max(0, Math.round(job.progress * 100)));
  const format = job.progressFormat ?? job.formats[0];
  const phase = job.progressPhase ? t(`phase.${job.progressPhase}`) : null;
  const eta =
    job.etaSeconds === null
      ? t("calculating")
      : job.etaSeconds === 0
        ? t("finishing")
        : t("eta", { time: formatRemaining(job.etaSeconds) });

  return (
    <div className="mt-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] text-nb-ink-soft">
        <span className="truncate">
          {format ? tp(`prep.format.${format}`) : tp("prep.waitingRecorder")}
          {phase ? ` · ${phase}` : ""}
        </span>
        <span className="shrink-0 font-semibold tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={t("progressLabel")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-nb-bg-2"
      >
        <div
          className="h-full rounded-full bg-nb-green-dark transition-[width] duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-[11px] text-nb-mute">{eta}</p>
    </div>
  );
}
