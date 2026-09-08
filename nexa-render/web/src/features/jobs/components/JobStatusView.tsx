"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { JobStatus } from "@/infrastructure/api/types";
import { cn } from "@/shared/lib/utils";
import { fileUrl } from "../api/jobs";
import { useJobStatus } from "../hooks/useJobStatus";
import "./JobStatusView.css";

const STATUS_TONE: Record<JobStatus, "queued" | "live" | "danger"> = {
  queued: "queued",
  running: "live",
  completed: "live",
  failed: "danger",
};

export function JobStatusView({ jobId }: { jobId: string }) {
  const t = useTranslations("jobStatus");
  const { data: job, error } = useJobStatus(jobId);

  if (error) {
    return (
      <div className="nr-job-card">
        {t("fetchError")} <code>{jobId}</code>.
      </div>
    );
  }

  if (!job) {
    return <div className="nr-job-card">{t("loading")}</div>;
  }

  const tone = STATUS_TONE[job.status];

  return (
    <div className="nr-job-card">
      <div className="mb-5 flex items-center gap-2.5">
        <span
          className={cn("nr-dot", tone === "live" && "is-live", tone === "danger" && "is-danger")}
        />
        <span className="text-lg font-bold">{t(`statusLabels.${job.status}`)}</span>
        <span className="label ml-auto">
          {job.engineUsed ?? job.engineRequested} · {job.fps}fps
        </span>
      </div>

      {job.status === "failed" && <p style={{ color: "var(--nr-danger)" }}>{job.error}</p>}

      {job.status === "completed" && job.result && (
        <div className="flex flex-col gap-5">
          {job.result.outputs.map((output) => {
            const filename = `${output.format}${output.path.slice(output.path.lastIndexOf("."))}`;
            return (
              <div key={output.format}>
                <div className="label mb-2">{output.format}</div>
                {/* biome-ignore lint/a11y/useMediaCaption: video generado sin pista de subtítulos */}
                <video
                  controls
                  src={fileUrl(job.id, filename)}
                  className="w-full max-w-[480px] rounded-[var(--radius-nr-md)] bg-black"
                />
              </div>
            );
          })}
        </div>
      )}

      {(job.status === "queued" || job.status === "running") && (
        <p style={{ color: "#cfcfd2" }}>{t("updatingHint")}</p>
      )}

      <Link href="/plantillas" className="label" style={{ display: "inline-block", marginTop: 24 }}>
        {t("backToTemplates")}
      </Link>
    </div>
  );
}
