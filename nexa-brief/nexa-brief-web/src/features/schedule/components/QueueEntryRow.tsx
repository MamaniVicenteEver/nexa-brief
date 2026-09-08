"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useCancelQueueEntryMutation } from "../hooks/useCancelQueueEntryMutation";
import type { QueueEntry, QueueStatus } from "../types";

function StatusBadge({ status }: { status: QueueStatus }) {
  const t = useTranslations("schedule");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        status === "published" && "bg-nb-green/15 text-nb-green-dark",
        status === "failed" && "bg-red-500/10 text-red-600",
        status === "publishing" && "bg-amber-500/15 text-amber-700",
        (status === "queued" || status === "cancelled") && "bg-nb-bg-2 text-nb-mute",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          status === "published" && "bg-nb-green-dark",
          status === "failed" && "bg-red-600",
          status === "publishing" && "bg-amber-600",
          (status === "queued" || status === "cancelled") && "bg-nb-mute",
        )}
      />
      {t(`queue.statusLabels.${status}`)}
    </span>
  );
}

export function QueueEntryRow({ entry, jobTitle }: { entry: QueueEntry; jobTitle?: string }) {
  const t = useTranslations("schedule");
  const cancelMutation = useCancelQueueEntryMutation();

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-nb-surface px-4 py-3.5 shadow-[0_10px_22px_-14px_rgba(40,30,10,0.2)] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-nb-ink">{jobTitle ?? entry.jobId}</div>
        <div className="mt-0.5 text-xs text-nb-mute">
          {t(`platforms.${entry.platform}`)} · {entry.accountAlias} ·{" "}
          {t(`queue.sourceLabels.${entry.source}`)}
          {entry.scheduledAt && ` · ${new Date(entry.scheduledAt).toLocaleString()}`}
        </div>
        {entry.status === "failed" && entry.error && (
          <div className="mt-1 text-xs text-red-600">{entry.error}</div>
        )}
        {entry.status === "published" && entry.url && (
          <a
            href={entry.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs font-semibold text-nb-ink underline-offset-2 hover:underline"
          >
            {t("queue.viewPost")}
          </a>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <StatusBadge status={entry.status} />
        {entry.status === "queued" && (
          <button
            type="button"
            disabled={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate(entry.entryId)}
            className="text-[12px] font-semibold text-red-600 underline-offset-2 hover:underline disabled:opacity-50"
          >
            {t("queue.cancelEntry")}
          </button>
        )}
      </div>
    </div>
  );
}
