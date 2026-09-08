"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { JobListItem, JobStage } from "@/features/create-video/types";
import { type QueueEntry, useQueueEntries } from "@/features/schedule";
import { cn } from "@/lib/utils";
import { useJobs } from "../hooks/useJobs";
import { VideoCard } from "./VideoCard";

type Tab = "listos" | "cola" | "publicados" | "fallidos";

const PAGE_SIZE = 20;

const STAGE_LABEL_KEY: Record<JobStage, string> = {
  pending: "pending",
  input_analyzed: "inputAnalyzed",
  design_complete: "designComplete",
  resources_fetched: "resourcesFetched",
  prompt_built: "promptBuilt",
  html_generated: "htmlGenerated",
  video_recorded: "videoRecorded",
  summary_generated: "summaryGenerated",
  packaged: "packaged",
  publishing: "publishing",
  published: "published",
  failed: "failed",
};

function ClockIcon() {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon, sibling text conveys meaning
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-4"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  );
}

function CrossIcon() {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon, sibling text conveys meaning
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-4"
      aria-hidden
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  );
}

export function BibliotecaView() {
  const t = useTranslations("library");
  const { data: jobs } = useJobs();
  const { data: queueEntries } = useQueueEntries({ status: "published" });
  const [activeTab, setActiveTab] = useState<Tab>("listos");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  const categories = useMemo(
    () => Array.from(new Set((jobs ?? []).map((j) => j.category))).sort(),
    [jobs],
  );

  const publishResultsByJobId = useMemo(() => {
    const map = new Map<string, QueueEntry[]>();
    for (const entry of queueEntries ?? []) {
      const current = map.get(entry.jobId) ?? [];
      current.push(entry);
      map.set(entry.jobId, current);
    }
    return map;
  }, [queueEntries]);

  const filtered = useMemo(() => {
    const all = jobs ?? [];
    return categoryFilter ? all.filter((j) => j.category === categoryFilter) : all;
  }, [jobs, categoryFilter]);

  const listos = filtered.filter((j) => j.stage === "packaged");
  const cola = filtered.filter((j) => !j.isTerminal);
  const publicados = filtered.filter((j) => j.stage === "published");
  const fallidos = filtered.filter((j) => j.stage === "failed");

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "listos", label: t("tabs.listos"), count: listos.length },
    { id: "cola", label: t("tabs.cola"), count: cola.length },
    { id: "publicados", label: t("tabs.publicados"), count: publicados.length },
    { id: "fallidos", label: t("tabs.fallidos"), count: fallidos.length },
  ];

  const activeList = { listos, cola, publicados, fallidos }[activeTab];
  const totalPages = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const showPagination = activeList.length > PAGE_SIZE;

  function selectTab(tab: Tab) {
    setActiveTab(tab);
    setPage(1);
  }

  function selectCategory(value: string) {
    setCategoryFilter(value);
    setPage(1);
  }

  return (
    <>
      <div className="mx-auto max-w-[1280px] px-10 pt-23 pb-4.5">
        <h1 className="font-nb-sans text-[clamp(20px,2.4vw,26px)] font-extrabold tracking-[-0.02em] whitespace-nowrap text-nb-ink">
          {t("title")}
        </h1>
      </div>

      <div className="relative z-5 mx-auto flex max-w-[1100px] flex-wrap items-end gap-4.5 px-10">
        <div className="flex min-w-[190px] flex-col gap-1.5">
          <label
            htmlFor="filterCategoria"
            className="text-[11px] font-semibold tracking-[0.05em] text-nb-mute uppercase"
          >
            {t("filters.categoryLabel")}
          </label>
          <select
            id="filterCategoria"
            value={categoryFilter}
            onChange={(e) => selectCategory(e.target.value)}
            className="rounded-xl border border-nb-line bg-nb-surface px-3.5 py-2.5 text-[13.5px] text-nb-ink outline-none focus:border-nb-green focus:ring-3 focus:ring-nb-green/25"
          >
            <option value="">{t("filters.allCategories")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => selectCategory("")}
          className="rounded-full border border-nb-line px-4 py-2.5 text-[12.5px] font-semibold text-nb-ink-soft transition-colors hover:bg-nb-bg-2 hover:text-nb-ink"
        >
          {t("filters.clearFilters")}
        </button>
      </div>

      <div className="relative z-5 mx-auto mt-6 flex max-w-[1100px] flex-wrap gap-2 px-10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectTab(tab.id)}
            className={cn(
              "rounded-full border border-nb-line bg-nb-surface px-4.5 py-2.5 text-[13.5px] font-semibold text-nb-mute transition-colors",
              activeTab === tab.id && "border-nb-ink bg-nb-ink text-[#fafaf7]",
            )}
          >
            {tab.label} <span className="ml-0.5 opacity-75">· {tab.count}</span>
          </button>
        ))}
      </div>

      <div className="relative z-5 mx-auto mt-6.5 max-w-[1100px] px-10 pb-25">
        {activeTab === "listos" &&
          (listos.length ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              {listos.slice(pageStart, pageStart + PAGE_SIZE).map((job) => (
                <VideoCard key={job.jobId} job={job} mode="ready" />
              ))}
            </div>
          ) : (
            <EmptyState />
          ))}

        {activeTab === "publicados" &&
          (publicados.length ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
              {publicados.slice(pageStart, pageStart + PAGE_SIZE).map((job) => (
                <VideoCard
                  key={job.jobId}
                  job={job}
                  mode="published"
                  publishResults={publishResultsByJobId.get(job.jobId) ?? []}
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          ))}

        {activeTab === "cola" &&
          (cola.length ? (
            <div className="flex flex-col gap-2.5">
              {cola.slice(pageStart, pageStart + PAGE_SIZE).map((job) => (
                <SimpleRow
                  key={job.jobId}
                  icon={<ClockIcon />}
                  job={job}
                  meta={t(`stages.${STAGE_LABEL_KEY[job.stage]}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          ))}

        {activeTab === "fallidos" &&
          (fallidos.length ? (
            <div className="flex flex-col gap-2.5">
              {fallidos.slice(pageStart, pageStart + PAGE_SIZE).map((job) => (
                <SimpleRow
                  key={job.jobId}
                  icon={<CrossIcon />}
                  job={job}
                  meta={job.category}
                  retry
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          ))}

        {showPagination && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full border border-nb-line px-4 py-2 text-[12.5px] font-semibold text-nb-ink-soft transition-colors hover:bg-nb-bg-2 hover:text-nb-ink disabled:pointer-events-none disabled:opacity-40"
            >
              {t("pagination.previous")}
            </button>
            <span className="text-[12.5px] text-nb-mute">
              {t("pagination.pageOf", { page, total: totalPages })}
            </span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-full border border-nb-line px-4 py-2 text-[12.5px] font-semibold text-nb-ink-soft transition-colors hover:bg-nb-bg-2 hover:text-nb-ink disabled:pointer-events-none disabled:opacity-40"
            >
              {t("pagination.next")}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function EmptyState() {
  const t = useTranslations("library");
  return <div className="py-7.5 text-center text-[13.5px] text-nb-mute">{t("emptyState")}</div>;
}

function SimpleRow({
  icon,
  job,
  meta,
  retry,
}: {
  icon: React.ReactNode;
  job: JobListItem;
  meta: string;
  retry?: boolean;
}) {
  const t = useTranslations("library");
  return (
    <div className="flex items-center gap-3.5 rounded-2xl bg-nb-surface px-4 py-3.5 shadow-[0_10px_22px_-14px_rgba(40,30,10,0.2)]">
      <div className="flex size-8.5 shrink-0 items-center justify-center rounded-[10px] bg-nb-bg-2 text-nb-ink-soft">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-nb-ink">{job.title}</div>
        <div className="mt-0.5 text-xs text-nb-mute">{meta}</div>
      </div>
      {retry ? (
        <button
          type="button"
          disabled
          title={t("comingSoon")}
          className="nb-btn-secondary ml-auto cursor-not-allowed rounded-full px-3.5 py-2 text-xs font-semibold opacity-50"
        >
          {t("retryButton")}
        </button>
      ) : (
        <span className="ml-auto shrink-0 text-xs whitespace-nowrap text-nb-mute">
          {new Date(job.updatedAt).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
