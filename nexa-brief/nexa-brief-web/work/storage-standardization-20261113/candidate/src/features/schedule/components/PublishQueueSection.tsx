"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useJobs } from "@/features/library";
import { useQueueEntries } from "../hooks/useQueueEntries";
import { QueueEntryRow } from "./QueueEntryRow";

export function PublishQueueSection() {
  const t = useTranslations("schedule");
  const { data: entries, isLoading, isError, isFetching } = useQueueEntries();
  const { data: jobs } = useJobs();

  const titleByJobId = useMemo(() => {
    const map = new Map<string, string>();
    for (const job of jobs ?? []) map.set(job.jobId, job.title);
    return map;
  }, [jobs]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[12.5px] text-nb-mute">{t("queue.description")}</p>
        {isFetching && !isLoading && (
          <span className="text-[11.5px] text-nb-mute">{t("common.updating")}</span>
        )}
      </div>

      {isError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] font-medium text-red-600">
          {t("queue.loadError")}
        </div>
      )}

      {isLoading ? (
        <p className="text-[13px] text-nb-mute">{t("queue.loading")}</p>
      ) : (entries ?? []).length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {(entries ?? []).map((entry) => (
            <QueueEntryRow
              key={entry.entryId}
              entry={entry}
              jobTitle={titleByJobId.get(entry.jobId)}
            />
          ))}
        </div>
      ) : (
        <div className="py-7.5 text-center text-[13.5px] text-nb-mute">{t("queue.empty")}</div>
      )}
    </div>
  );
}
