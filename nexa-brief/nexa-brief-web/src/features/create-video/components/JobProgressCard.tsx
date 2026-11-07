"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ProgressBar, type ProgressTone } from "@/shared/components/ui/progress-bar";
import { useJobStatus } from "../hooks/useJobStatus";
import { useNicheName } from "../hooks/useNicheName";
import { deriveJobProgress, formatEta, type JobProgressView } from "../lib/job-progress";
import type { JobDetail, JobHandle } from "../types";

const TONE: Record<JobProgressView["status"], ProgressTone> = {
  queued: "waiting",
  running: "active",
  done: "success",
  failed: "error",
};

const CARD_STYLE: Record<JobProgressView["status"], string> = {
  queued: "border-nb-accent-amber/40 bg-nb-accent-amber/10",
  running: "border-nb-line bg-nb-surface",
  done: "border-nb-green/60 bg-nb-surface",
  failed: "border-red-500/30 bg-red-500/5",
};

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function StatusPill({ view }: { view: JobProgressView }) {
  const t = useTranslations("createVideo.jobProgress");
  const label =
    view.status === "queued"
      ? view.queuePosition
        ? t("queuePosition", { position: view.queuePosition })
        : t("queued")
      : view.status === "done"
        ? t("ready")
        : view.status === "failed"
          ? t("failed")
          : view.percent === null
            ? t("working")
            : `${Math.floor(view.percent)}%`;

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
        view.status === "queued" && "bg-nb-accent-amber/25 text-amber-800",
        view.status === "running" && "bg-nb-green/40 text-nb-green-dark",
        view.status === "done" && "bg-nb-green-dark text-white",
        view.status === "failed" && "bg-red-600 text-white",
      )}
    >
      {label}
    </span>
  );
}

function StatusLine({ view }: { view: JobProgressView }) {
  const t = useTranslations("createVideo");

  if (view.status === "queued") {
    return <p className="text-[12px] text-nb-mute">{t("jobProgress.queuedHint")}</p>;
  }
  if (view.status !== "running") return null;

  const waitingForRecorder = view.step === "video_recorder" && view.stepPercent === 0;
  const stepLabel = view.step ? t(`steps.${view.step}`) : t("jobProgress.working");
  const eta = view.etaSeconds !== null ? formatEta(view.etaSeconds) : null;

  return (
    <div className="flex flex-col gap-0.5 text-[12px]">
      <p className="font-semibold text-nb-ink-soft">
        {waitingForRecorder ? t("jobProgress.waitingRecorder") : stepLabel}
        {view.stepCount > 0 && (
          <span className="font-normal text-nb-mute">
            {" · "}
            {t("jobProgress.stepOf", { index: view.stepIndex, count: view.stepCount })}
          </span>
        )}
      </p>
      <p className="text-nb-mute">
        {eta ? t(`jobProgress.eta.${eta.unit}`, eta) : t("jobProgress.calculating")}
      </p>
    </div>
  );
}

function SuccessBody({ jobId, data }: { jobId: string; data: JobDetail }) {
  const t = useTranslations("createVideo.jobProgress");
  const videoUrl = data.files.find((f) => f.format === "youtube")?.url ?? null;
  return (
    <div className="flex flex-col gap-3">
      {videoUrl && (
        <div className="overflow-hidden rounded-xl bg-black">
          {/** biome-ignore lint/a11y/useMediaCaption: video generado por el pipeline, sin pista de subtítulos disponible */}
          <video src={videoUrl} controls playsInline className="block w-full" />
        </div>
      )}
      <Link
        href={`/biblioteca/${jobId}`}
        className="group flex flex-col gap-0.5 text-[12.5px] no-underline"
      >
        <span className="line-clamp-2 font-bold text-nb-ink group-hover:underline">
          {data.title}
        </span>
        <span className="text-nb-mute">
          {data.durationSeconds !== null && `${formatDuration(data.durationSeconds)} · `}
          {t("viewDetails")}
        </span>
      </Link>
    </div>
  );
}

/** One job's live status: queue position → % + current step + ETA → result. Reused by the jobs tray. */
export function JobProgressCard({
  job,
  actions,
  label,
}: {
  job: JobHandle;
  actions?: React.ReactNode;
  /** Nombre de la grabación (Estudio de NodeMotion); el nicho queda como subtítulo. */
  label?: string;
}) {
  const t = useTranslations("createVideo.jobProgress");
  const { data } = useJobStatus(job.jobId);
  const nicheName = useNicheName(data?.category ?? job.category);
  const name = label || nicheName;
  const view = deriveJobProgress(data, job.stage);
  const fillWidth = view.status === "running" && view.percent !== null ? view.percent : 0;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border p-3.5 shadow-[0_12px_28px_-14px_rgba(40,30,10,0.35)] transition-colors",
        CARD_STYLE[view.status],
      )}
    >
      {/* The whole card fills with green from the left as the job advances. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 bg-nb-green/25 transition-[width] duration-700 ease-out"
        style={{ width: `${fillWidth}%` }}
      />
      <div className="relative flex flex-col gap-2.5">
        <header className="flex items-center gap-2 pr-6">
          <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-nb-ink">
            {name}
            {label && (
              <span className="block truncate text-[11px] font-normal text-nb-mute">
                {nicheName}
              </span>
            )}
          </h3>
          <StatusPill view={view} />
        </header>
        {actions && <div className="absolute -top-1 -right-1">{actions}</div>}

        <StatusLine view={view} />

        {view.status !== "done" && (
          <ProgressBar
            value={view.percent}
            tone={TONE[view.status]}
            label={t("barLabel", { name })}
          />
        )}

        {view.status === "failed" &&
          data?.errors.map((err) => (
            <p key={err} className="line-clamp-3 text-[11.5px] text-red-700">
              {err}
            </p>
          ))}

        {view.status === "done" && data && <SuccessBody jobId={job.jobId} data={data} />}
      </div>
    </article>
  );
}
