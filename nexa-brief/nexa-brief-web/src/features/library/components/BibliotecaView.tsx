"use client";

import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ACTIVE_JOB_STATES, type ExplainerJob } from "@/features/explainer/types";
import { useExplainerRecordings } from "@/features/explainer/hooks/useExplainer";
import { type QueueEntry, useQueueEntries } from "@/features/schedule";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useCategoryLabels } from "../hooks/useCategoryLabels";
import { useJobs } from "../hooks/useJobs";
import { deriveStatus, type LibraryStatus, type LibraryVideo } from "../library-status";
import { ExplainerRecordingCard } from "./ExplainerRecordingCard";
import { VideoCard } from "./VideoCard";

type Tab = "todos" | "pendientes" | "publicados" | "proceso" | "fallidos";
type Sort = "newest" | "oldest" | "longest" | "title";
type LibraryItem =
  | {
      kind: "video";
      key: string;
      status: LibraryStatus;
      category: string;
      categoryLabel: string;
      title: string;
      updatedAt: string;
      durationSeconds: number | null;
      video: LibraryVideo;
    }
  | {
      kind: "recording";
      key: string;
      status: "processing" | "failed";
      category: string;
      categoryLabel: string;
      title: string;
      updatedAt: string;
      durationSeconds: null;
      recording: ExplainerJob;
    };

const PAGE_SIZE = 24;

const TAB_STATUSES: Record<Tab, LibraryStatus[] | null> = {
  todos: null,
  pendientes: ["ready", "scheduled"],
  publicados: ["published"],
  proceso: ["processing"],
  fallidos: ["failed"],
};

const TAB_ORDER: Tab[] = ["todos", "pendientes", "publicados", "proceso", "fallidos"];
const SORTS: Sort[] = ["newest", "oldest", "longest", "title"];

function groupByJob(entries: QueueEntry[] | undefined, statuses: QueueEntry["status"][]) {
  const map = new Map<string, QueueEntry[]>();
  for (const entry of entries ?? []) {
    if (!statuses.includes(entry.status)) continue;
    const list = map.get(entry.jobId) ?? [];
    list.push(entry);
    map.set(entry.jobId, list);
  }
  return map;
}

export function BibliotecaView() {
  const t = useTranslations("library");
  const { data: jobs, isLoading, isError } = useJobs();
  const { data: recordingJobs, isLoading: recordingsLoading } = useExplainerRecordings();
  const { data: queueEntries } = useQueueEntries({ limit: 200 });
  const categoryLabel = useCategoryLabels();
  const libraryLoading = isLoading || recordingsLoading;

  // `?tab=pendientes` (ej. desde el dashboard) abre directo esa pestaña.
  const tabParam = useSearchParams().get("tab");
  const [activeTab, setActiveTab] = useState<Tab>(
    TAB_ORDER.includes(tabParam as Tab) ? (tabParam as Tab) : "todos",
  );
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);

  const videos = useMemo<LibraryVideo[]>(() => {
    const published = groupByJob(queueEntries, ["published"]);
    const scheduled = groupByJob(queueEntries, ["queued", "publishing"]);
    return (jobs ?? []).map((job) => {
      const jobPublished = published.get(job.jobId) ?? [];
      const jobScheduled = scheduled.get(job.jobId) ?? [];
      return {
        job,
        published: jobPublished,
        scheduled: jobScheduled,
        status: deriveStatus(job, jobPublished, jobScheduled),
        categoryLabel: categoryLabel(job.category),
      };
    });
  }, [jobs, queueEntries, categoryLabel]);

  const items = useMemo<LibraryItem[]>(() => {
    const videoItems: LibraryItem[] = videos.map((video) => ({
      kind: "video",
      key: video.job.jobId,
      status: video.status,
      category: video.job.category,
      categoryLabel: video.categoryLabel,
      title: video.job.title,
      updatedAt: video.job.updatedAt,
      durationSeconds: video.job.durationSeconds,
      video,
    }));
    const recordingItems: LibraryItem[] = (recordingJobs ?? [])
      .filter((job) => job.state !== "done")
      .map((recording) => ({
        kind: "recording",
        key: recording.jobId,
        status: ACTIVE_JOB_STATES.includes(recording.state) ? "processing" : "failed",
        category: recording.categoryPath,
        categoryLabel: categoryLabel(recording.categoryPath),
        title: recording.title || recording.videoId,
        updatedAt: recording.startedAt || "",
        durationSeconds: null,
        recording,
      }));
    return [...videoItems, ...recordingItems];
  }, [videos, recordingJobs, categoryLabel]);

  // Búsqueda + categoría se aplican antes de las pestañas, así los contadores
  // de cada pestaña reflejan lo que el usuario está filtrando.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category && item.category !== category) return false;
      if (!q) return true;
      return [item.title, item.categoryLabel, item.category, item.key].some((field) =>
        field.toLowerCase().includes(q),
      );
    });
  }, [items, category, query]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return Array.from(counts, ([id, count]) => ({ id, count, label: categoryLabel(id) })).sort(
      (a, b) => a.label.localeCompare(b.label),
    );
  }, [items, categoryLabel]);

  const tabCounts = useMemo(() => {
    const counts = {} as Record<Tab, number>;
    for (const tab of TAB_ORDER) {
      const statuses = TAB_STATUSES[tab];
      counts[tab] = statuses
        ? searched.filter((v) => statuses.includes(v.status)).length
        : searched.length;
    }
    return counts;
  }, [searched]);

  const activeList = useMemo(() => {
    const statuses = TAB_STATUSES[activeTab];
    const list = statuses ? searched.filter((v) => statuses.includes(v.status)) : [...searched];
    const byDate = (item: LibraryItem) => new Date(item.updatedAt).getTime() || 0;
    const compare: Record<Sort, (a: LibraryItem, b: LibraryItem) => number> = {
      newest: (a, b) => byDate(b) - byDate(a),
      oldest: (a, b) => byDate(a) - byDate(b),
      longest: (a, b) => (b.durationSeconds ?? -1) - (a.durationSeconds ?? -1),
      title: (a, b) => a.title.localeCompare(b.title),
    };
    return list.sort(compare[sort]);
  }, [searched, activeTab, sort]);

  const totalPages = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = activeList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtersActive = category !== "" || query.trim() !== "";

  const resetPage =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };
  const selectTab = resetPage(setActiveTab);
  const selectCategory = resetPage(setCategory);
  const changeQuery = resetPage(setQuery);

  function clearFilters() {
    setCategory("");
    setQuery("");
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-22 pb-25 sm:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-nb-sans text-[clamp(22px,2.6vw,30px)] font-extrabold tracking-[-0.02em] text-nb-ink">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-[560px] text-[13.5px] text-nb-mute">{t("subtitle")}</p>
        </div>
        <Link
          href="/crear-video"
          className="nb-btn-pill inline-flex items-center gap-1.5 px-4.5 py-2.5 text-[13px] font-semibold"
        >
          <Plus className="size-4" />
          {t("createVideo")}
        </Link>
      </header>

      {/* Toolbar: búsqueda + orden */}
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-nb-mute" />
          <input
            type="search"
            value={query}
            onChange={(e) => changeQuery(e.target.value)}
            placeholder={t("filters.searchPlaceholder")}
            aria-label={t("filters.searchPlaceholder")}
            className="w-full rounded-full border border-nb-line bg-nb-surface py-2.5 pr-10 pl-10 text-[13.5px] text-nb-ink outline-none placeholder:text-nb-mute focus:border-nb-green-dark focus:ring-3 focus:ring-nb-green/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => changeQuery("")}
              aria-label={t("filters.clearFilters")}
              className="absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-nb-mute hover:bg-nb-bg-2 hover:text-nb-ink"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 rounded-full border border-nb-line bg-nb-surface py-1 pr-1.5 pl-3.5 text-[12.5px] font-semibold text-nb-mute">
          <SlidersHorizontal className="size-3.5" />
          <span className="sr-only sm:not-sr-only">{t("filters.sortLabel")}</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="cursor-pointer rounded-full bg-transparent py-1.5 pr-1 text-[13px] text-nb-ink outline-none"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`filters.sort.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Categorías */}
      {categories.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold tracking-[0.05em] text-nb-mute uppercase">
            {t("filters.categoryLabel")}
          </span>
          <CategoryChip
            label={t("filters.allCategories")}
            count={items.length}
            active={category === ""}
            onClick={() => selectCategory("")}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.label}
              count={c.count}
              active={category === c.id}
              onClick={() => selectCategory(category === c.id ? "" : c.id)}
            />
          ))}
        </div>
      )}

      {/* Pestañas de estado */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-nb-line">
        <div
          role="tablist"
          className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TAB_ORDER.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => selectTab(tab)}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3.5 py-2.5 text-[13.5px] font-semibold whitespace-nowrap text-nb-mute transition-colors hover:text-nb-ink",
                activeTab === tab && "border-nb-ink text-nb-ink",
              )}
            >
              {t(`tabs.${tab}`)}
              <span
                className={cn(
                  "min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] tabular-nums",
                  activeTab === tab ? "bg-nb-ink text-[#fafaf7]" : "bg-nb-bg-2 text-nb-ink-soft",
                  tab === "pendientes" &&
                    tabCounts[tab] > 0 &&
                    activeTab !== tab &&
                    "bg-nb-accent-gold text-nb-ink",
                )}
              >
                {libraryLoading ? "–" : tabCounts[tab]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 pb-2 text-[12.5px] text-nb-mute">
          {!libraryLoading && <span>{t("resultsCount", { count: activeList.length })}</span>}
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-nb-ink-soft hover:bg-nb-bg-2 hover:text-nb-ink"
            >
              <X className="size-3.5" />
              {t("filters.clearFilters")}
            </button>
          )}
        </div>
      </div>

      <div className="mt-6">
        {libraryLoading ? (
          <CardGrid>
            {Array.from({ length: 8 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeletons estáticos sin identidad
              <SkeletonCard key={i} />
            ))}
          </CardGrid>
        ) : isError ? (
          <EmptyState message={t("loadError")} />
        ) : items.length === 0 ? (
          <EmptyState
            message={t("emptyLibrary")}
            action={
              <Link
                href="/crear-video"
                className="nb-btn-pill px-4.5 py-2.5 text-[13px] font-semibold"
              >
                {t("createVideo")}
              </Link>
            }
          />
        ) : pageItems.length === 0 ? (
          <EmptyState
            message={t("emptyState")}
            action={
              filtersActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="nb-btn-secondary rounded-full px-4.5 py-2.5 text-[13px] font-semibold"
                >
                  {t("filters.clearFilters")}
                </button>
              )
            }
          />
        ) : (
          <CardGrid>
            {pageItems.map((item) =>
              item.kind === "video" ? (
                <VideoCard key={item.key} video={item.video} />
              ) : (
                <ExplainerRecordingCard
                  key={item.key}
                  job={item.recording}
                  categoryLabel={item.categoryLabel}
                />
              )
            )}
          </CardGrid>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              className="rounded-full border border-nb-line px-4 py-2 text-[12.5px] font-semibold text-nb-ink-soft transition-colors hover:bg-nb-bg-2 hover:text-nb-ink disabled:pointer-events-none disabled:opacity-40"
            >
              {t("pagination.previous")}
            </button>
            <span className="text-[12.5px] text-nb-mute">
              {t("pagination.pageOf", { page: currentPage, total: totalPages })}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="rounded-full border border-nb-line px-4 py-2 text-[12.5px] font-semibold text-nb-ink-soft transition-colors hover:bg-nb-bg-2 hover:text-nb-ink disabled:pointer-events-none disabled:opacity-40"
            >
              {t("pagination.next")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,272px),1fr))] gap-5">
      {children}
    </div>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex max-w-[260px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
        active
          ? "border-nb-ink bg-nb-ink text-[#fafaf7]"
          : "border-nb-line bg-nb-surface text-nb-ink-soft hover:border-nb-ink/40 hover:text-nb-ink",
      )}
    >
      <span className="truncate">{label}</span>
      <span className={cn("tabular-nums", active ? "opacity-70" : "text-nb-mute")}>{count}</span>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[20px] bg-nb-surface">
      <div className="aspect-video w-full animate-pulse bg-nb-bg-2" />
      <div className="space-y-2.5 px-4.5 py-4">
        <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-nb-bg-2" />
        <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-nb-bg-2" />
        <div className="h-8 w-full animate-pulse rounded-full bg-nb-bg-2" />
      </div>
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-[20px] border border-dashed border-nb-line px-6 py-16 text-center">
      <Search className="size-6 text-nb-mute" />
      <p className="text-[13.5px] text-nb-mute">{message}</p>
      {action}
    </div>
  );
}
