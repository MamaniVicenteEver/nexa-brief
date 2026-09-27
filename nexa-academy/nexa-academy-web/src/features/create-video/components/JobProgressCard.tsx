"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useJobStatus } from "../hooks/useJobStatus";
import { STAGE_LABEL_KEY } from "../stage";
import type { JobHandle } from "../types";

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function JobProgressCard({ job }: { job: JobHandle }) {
  const t = useTranslations("createVideo");
  const { data } = useJobStatus(job.jobId);
  const stage = data?.stage ?? job.stage;
  const category = data?.category ?? job.category;

  if (stage === "failed") {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-semibold text-destructive">
          {category} — {t(`stages.${STAGE_LABEL_KEY.failed}`)}
        </p>
        {data?.errors.map((err) => (
          <p key={err} className="mt-1 text-xs text-destructive/80">
            {err}
          </p>
        ))}
      </div>
    );
  }

  if (data?.isSuccess && data) {
    const videoUrl = data.files.find((f) => f.format === "youtube")?.url ?? null;
    return (
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-nb-green/40 bg-nb-green/5 p-4">
        {videoUrl && (
          <div className="relative overflow-hidden rounded-2xl bg-black">
            {/** biome-ignore lint/a11y/useMediaCaption: video generado por el pipeline, sin pista de subtítulos disponible */}
            <video src={videoUrl} controls playsInline className="block w-full" />
            <Link
              href={`/biblioteca/${job.jobId}`}
              className="absolute top-2 right-2 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold text-white hover:bg-black/85"
            >
              {t("jobProgress.viewDetails")}
            </Link>
          </div>
        )}
        <Link href={`/biblioteca/${job.jobId}`} className="flex flex-col gap-2 text-sm">
          <p className="font-bold text-nb-ink">{data.title}</p>
          <p className="text-nb-mute">
            {t("jobProgress.category")}:{" "}
            <span className="font-semibold text-nb-ink">{category}</span>
          </p>
          {data.durationSeconds !== null && (
            <p className="text-nb-mute">
              {t("jobProgress.duration")}:{" "}
              <span className="font-semibold text-nb-ink">
                {formatDuration(data.durationSeconds)}
              </span>
            </p>
          )}
          <p className="text-nb-green-dark font-semibold">
            {t(`stages.${STAGE_LABEL_KEY[stage]}`)}
          </p>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-nb-accent-amber/40 bg-nb-accent-amber/10 p-4">
      <p className="text-sm font-semibold text-nb-ink">{category}</p>
      <p className="mt-1 text-xs text-nb-mute">{t(`stages.${STAGE_LABEL_KEY[stage]}`)}</p>
    </div>
  );
}
