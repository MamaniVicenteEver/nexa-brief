"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useJobStatus } from "@/features/create-video/hooks/useJobStatus";
import { PublishNowDialog } from "@/features/schedule";
import { DownloadButtons } from "./DownloadButtons";
import { PlatformCopyCard } from "./PlatformCopyCard";
import { PublicationsList } from "./PublicationsList";
import { COPY_PLATFORMS, platformCopy, SectionTitle } from "./sidebar-shared";

/** Pestaña "Publicación": los textos que usa el video en cada red, dónde se
 * publicó y el atajo para publicarlo en otra cuenta. */
export function PublishingTab({
  jobId,
  jobTitle,
  canPublish,
}: {
  jobId: string;
  jobTitle: string;
  canPublish: boolean;
}) {
  const t = useTranslations("library.playerSidebar");
  const tCard = useTranslations("library.videoCard");
  const { data: job, isLoading } = useJobStatus(jobId);
  const summary = job?.summary ?? null;

  return (
    <div className="flex flex-col gap-5">
      {job?.isTerminal && job.isSuccess && (
        <DownloadButtons jobId={jobId} hasVertical={job.formats.includes("9x16")} />
      )}

      <section className="flex flex-col gap-2.5">
        <SectionTitle>{t("copy.heading")}</SectionTitle>
        {isLoading ? (
          <div className="h-28 animate-pulse rounded-xl bg-nb-bg-2" />
        ) : summary ? (
          COPY_PLATFORMS.map((platform) => (
            <PlatformCopyCard
              key={platform}
              platform={platform}
              copy={platformCopy(summary, platform)}
              pinnedComment={platform === "youtube" ? summary.pinnedComment : ""}
            />
          ))
        ) : (
          <p className="text-[12.5px] text-nb-mute">{t("copy.empty")}</p>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionTitle>{t("publications.heading")}</SectionTitle>
        <PublicationsList jobId={jobId} />
      </section>

      {canPublish && (
        <PublishNowDialog jobId={jobId} jobTitle={jobTitle}>
          <button
            type="button"
            className="nb-btn-pill inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold"
          >
            <Send className="size-3.5" />
            {tCard("publishAgain")}
          </button>
        </PublishNowDialog>
      )}
    </div>
  );
}
