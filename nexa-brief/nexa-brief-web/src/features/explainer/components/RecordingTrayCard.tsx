"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { JOBS_QUERY_KEY } from "@/features/library";
import { Link } from "@/i18n/navigation";
import { getExplainerJob } from "../api/explainer-service";
import type { TrackedRecording } from "../store/recording-tray-store";
import { useRecordingTrayStore } from "../store/recording-tray-store";
import { ACTIVE_JOB_STATES } from "../types";

export function RecordingTrayCard({ tracked }: { tracked: TrackedRecording }) {
  const t = useTranslations("explainer.tray");
  const tp = useTranslations("templates");
  const remove = useRecordingTrayStore((state) => state.removeRecording);
  const queryClient = useQueryClient();
  const { data: job, isError } = useQuery({
    queryKey: ["explainer-record-job", tracked.jobId],
    queryFn: ({ signal }) => getExplainerJob(tracked.jobId, signal),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return !state || ACTIVE_JOB_STATES.includes(state) ? 4_000 : false;
    },
    retry: 1,
  });
  useEffect(() => {
    if (job?.scheduledJobId || job?.state === "done" || job?.state === "failed") {
      queryClient.invalidateQueries({ queryKey: JOBS_QUERY_KEY });
    }
  }, [job?.scheduledJobId, job?.state, queryClient]);
  const busy = !job || ACTIVE_JOB_STATES.includes(job.state);
  const failed = job?.publishResults.filter((r) => r.error) ?? [];
  return (
    <article className="rounded-2xl border border-nb-line bg-nb-surface p-3 text-[12px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold text-nb-ink">{tracked.title}</p>
          <p className="mt-0.5 flex items-center gap-1 text-nb-ink-soft">
            {busy && !isError && <Loader2 className="size-3 animate-spin" />}
            {isError ? t("unavailable") : job ? tp(`prep.jobState.${job.state}`) : t("starting")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => remove(tracked.jobId)}
          aria-label={t("dismiss")}
          className="rounded-full p-1 text-nb-mute hover:bg-nb-bg-2"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {job && (
        <>
          <p className="mt-2 text-nb-mute">
            {job.formats.map((f) => tp(`prep.format.${f}`)).join(" · ")}
          </p>
          {job.publishResults.map((result) =>
            result.url ? (
              <a
                key={result.accountSelector}
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 flex items-center gap-1 text-nb-green-dark underline"
              >
                {result.accountSelector} <ExternalLink className="size-3" />
              </a>
            ) : (
              <p key={result.accountSelector} className="mt-1 text-red-700">
                {result.accountSelector}: {result.error}
              </p>
            ),
          )}
          {job.error && failed.length === 0 && <p className="mt-1 text-red-700">{job.error}</p>}
          {job.scheduledJobId && (
            <Link
              href={`/biblioteca/${job.scheduledJobId}`}
              className="mt-2 block font-semibold text-nb-ink underline"
            >
              {t("viewLibrary")}
            </Link>
          )}
          {job.state === "done" && (
            <p className="mt-1 font-semibold text-nb-green-dark">{t("finished")}</p>
          )}
        </>
      )}
    </article>
  );
}
