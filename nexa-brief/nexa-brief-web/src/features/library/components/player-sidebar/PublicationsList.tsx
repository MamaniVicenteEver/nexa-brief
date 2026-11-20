"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { PLATFORM_META, PlatformIcon } from "@/features/channels";
import { useChannels } from "@/features/channels/hooks/useChannels";
import { useQueueEntries } from "@/features/schedule";
import { cn } from "@/lib/utils";
import { useJobPublications } from "../../hooks/useJobDeletion";
import { buildPublicationRows, formatLabel, type PublicationRow } from "./publication-rows";

const STATUS_CLASS: Partial<Record<PublicationRow["status"], string>> = {
  published: "bg-nb-green/25 text-nb-green-dark",
  publishing: "bg-nb-accent-amber/25 text-nb-ink-soft",
  failed: "bg-red-600/10 text-red-600",
  queued: "bg-nb-accent-gold/30 text-nb-ink-soft",
};

/** "Dónde se publicó": cola de publicación del job + registro de publicados. */
export function PublicationsList({ jobId }: { jobId: string }) {
  const t = useTranslations("library.playerSidebar.publications");
  const tQueue = useTranslations("schedule.queue");
  const { data: channels } = useChannels();
  const { data: entries, isLoading: entriesLoading } = useQueueEntries({ jobId });
  const { data: publications, isLoading, isError } = useJobPublications(jobId, true);

  if (entriesLoading || isLoading) {
    return <div className="h-16 animate-pulse rounded-xl bg-nb-bg-2" />;
  }

  const rows = buildPublicationRows(entries ?? [], publications ?? []);
  const channelName = (row: PublicationRow) =>
    channels?.find((c) => c.platform === row.platform && c.alias === row.accountAlias)?.name ||
    row.accountAlias;

  if (rows.length === 0) {
    return (
      <p className={cn("text-[12.5px]", isError ? "text-red-600" : "text-nb-mute")}>
        {isError ? t("error") : t("empty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <li key={row.key} className="rounded-xl border border-nb-line bg-white/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <PlatformIcon platform={row.platform} className="size-6" rounded="rounded-md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-nb-ink">
                {PLATFORM_META[row.platform].label} · {channelName(row)}
              </p>
              <p className="text-[11px] text-nb-mute">
                {[
                  row.format && formatLabel(row.format),
                  row.date &&
                    new Date(row.date).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                ]
                  .filter(Boolean)
                  .join(" · ") || t("noDate")}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                STATUS_CLASS[row.status] ?? "bg-nb-bg-2 text-nb-ink-soft",
              )}
            >
              {tQueue(`statusLabels.${row.status}`)}
            </span>
            {row.url && (
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                aria-label={t("open")}
                title={t("open")}
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-nb-ink hover:bg-nb-bg-2"
              >
                <ArrowUpRight className="size-4" />
              </a>
            )}
          </div>
          {row.error && (
            <p className="mt-1 line-clamp-2 text-[11px] text-red-600" title={row.error}>
              {row.error}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
