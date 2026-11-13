"use client";

import {
  Activity,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Film,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Upload,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useScheduleOverview } from "../hooks/useScheduleOverview";
import {
  type AgendaEvent,
  type AgendaKind,
  dateInZone,
  filterAgenda,
  shiftDay,
} from "../lib/agenda";
import { AgendaDetails } from "./AgendaDetails";
import { AgendaPhase, AgendaStatusBadge } from "./AgendaStatus";
import { CategoryAutomationSection } from "./CategoryAutomationSection";
import { PlannerSection } from "./PlannerSection";
import { ScheduleSlotsSection } from "./ScheduleSlotsSection";

const ZONE = "America/La_Paz";
const PAGE_SIZE = 8;
const FIELD =
  "h-9 min-w-0 rounded-xl border border-nb-line bg-white/70 px-3 text-xs text-nb-ink outline-none focus:border-nb-green-dark focus:ring-2 focus:ring-nb-green/20";
const KIND_ICON = { plan: CalendarDays, preparation: Sparkles, render: Film, publication: Upload };
const KIND_TONE = {
  plan: "bg-stone-100 text-stone-500",
  preparation: "bg-blue-50 text-blue-600",
  render: "bg-violet-50 text-violet-600",
  publication: "bg-nb-green/15 text-nb-green-dark",
};

function AgendaRow({
  event,
  zone,
  category,
  onOpen,
}: {
  event: AgendaEvent;
  zone: string;
  category: string;
  onOpen: () => void;
}) {
  const t = useTranslations("schedule.dashboard");
  const locale = useLocale();
  const Icon = KIND_ICON[event.kind];
  const date = event.at ? new Date(event.at) : null;
  const day = date
    ? new Intl.DateTimeFormat(locale, { timeZone: zone, day: "2-digit", month: "short" }).format(
        date,
      )
    : "—";
  const time = date
    ? new Intl.DateTimeFormat(locale, {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(date)
    : "—";
  const progress =
    event.kind === "render" && event.recording?.state === "rendering"
      ? Math.round(event.recording.progress * 100)
      : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid w-full grid-cols-[52px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-nb-line/60 px-4 py-4 text-left transition-colors last:border-0 hover:bg-stone-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-nb-green-dark sm:grid-cols-[76px_minmax(0,1fr)_160px_20px] sm:gap-4 sm:px-6"
    >
      <span className="row-span-2 self-start pt-0.5 sm:row-span-1">
        <span className="block text-base font-bold tracking-tight text-nb-ink tabular-nums">
          {time}
        </span>
        <span className="mt-0.5 block text-[10px] font-medium text-stone-500">
          {date ? day : t("noTime")}
        </span>
      </span>
      <span className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 hidden size-9 shrink-0 items-center justify-center rounded-xl md:flex",
            KIND_TONE[event.kind],
          )}
        >
          <Icon size={16} />
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 text-[13px] leading-relaxed font-semibold text-nb-ink sm:line-clamp-1">
            {event.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-stone-500">
            <span>{t(`kinds.${event.kind}`)}</span>
            <span aria-hidden>·</span>
            <span>{category}</span>
            {(event.production?.design || event.plan?.design) && (
              <>
                <span aria-hidden>·</span>
                <span>{event.production?.design || event.plan?.design}</span>
              </>
            )}
            {event.publication && (
              <>
                <span aria-hidden>·</span>
                <span>{event.publication.platform}</span>
              </>
            )}
          </span>
        </span>
      </span>
      <span className="col-start-2 flex min-w-0 flex-col items-start gap-1.5 sm:col-start-auto">
        <AgendaStatusBadge event={event} />
        <span className="hidden text-[10px] text-stone-500 sm:block">
          <AgendaPhase event={event} />
          {progress !== null && <span> · {progress} %</span>}
        </span>
        {progress !== null && (
          <progress
            aria-label={t("renderProgress")}
            max={100}
            value={progress}
            className="hidden h-1 w-full max-w-28 accent-violet-600 sm:block"
          />
        )}
      </span>
      <ChevronRight size={15} className="hidden text-stone-300 group-hover:text-nb-ink sm:block" />
    </button>
  );
}

export function ScheduleView() {
  const t = useTranslations("schedule.dashboard");
  const locale = useLocale();
  const overview = useScheduleOverview();
  const [kind, setKind] = useState<AgendaKind | "all">("all");
  const [range, setRange] = useState<"day" | "week" | "all">("day");
  const [zone, setZone] = useState(ZONE);
  const [day, setDay] = useState(() => dateInZone(Date.now(), ZONE));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "attention" | "upcoming">("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"planner" | "settings" | null>(null);
  const [settingsTab, setSettingsTab] = useState<"categories" | "slots">("categories");
  const filtered = useMemo(
    () => filterAgenda(overview.events, { kind, range, day, zone, search, status }),
    [overview.events, kind, range, day, zone, search, status],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selected = overview.events.find((event) => event.id === selectedId);
  const active = overview.events.filter((e) => e.status === "active" || e.status === "queued");
  const errors = overview.events.filter((e) => e.status === "failed");
  const prepared = overview.events.filter((e) => e.status === "ready");
  const upcoming = overview.events.filter((e) =>
    ["planned", "scheduled", "queued"].includes(e.status),
  );
  const categoryName = (path: string | null) =>
    overview.categories.find((c) => c.categoryId === path?.split("/")[0])?.displayName ||
    path ||
    t("general");
  const tabs: { id: AgendaKind | "all"; icon: typeof CalendarDays; label: string }[] = [
    { id: "all", icon: CalendarDays, label: t("tabs.all") },
    { id: "preparation", icon: Sparkles, label: t("tabs.preparation") },
    { id: "render", icon: Film, label: t("tabs.render") },
    { id: "publication", icon: Upload, label: t("tabs.publication") },
  ];
  const metrics = [
    {
      key: "upcoming",
      value: upcoming.length,
      label: t("metrics.upcoming"),
      hint: t("metrics.upcomingHint"),
      icon: CalendarDays,
      tone: "text-blue-600",
      action: () => {
        setRange("all");
        setStatus("upcoming");
      },
    },
    {
      key: "active",
      value: active.length,
      label: t("metrics.active"),
      hint: t("metrics.activeHint"),
      icon: Activity,
      tone: "text-amber-600",
      action: () => {
        setRange("all");
        setStatus("active");
      },
    },
    {
      key: "ready",
      value: prepared.length,
      label: t("metrics.ready"),
      hint: t("metrics.readyHint"),
      icon: Sparkles,
      tone: "text-nb-green-dark",
      action: () => {
        setKind("preparation");
        setRange("all");
        setStatus("all");
      },
    },
    {
      key: "attention",
      value: errors.length,
      label: t("metrics.attention"),
      hint: t("metrics.attentionHint"),
      icon: CircleAlert,
      tone: errors.length ? "text-red-600" : "text-stone-400",
      action: () => {
        setRange("all");
        setStatus("attention");
      },
    },
  ];
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
  return (
    <div
      data-schedule-workspace
      className="mx-auto w-full max-w-[1440px] px-4 pt-24 pb-10 sm:px-6 lg:px-8"
    >
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-[10px] font-bold tracking-[.16em] text-nb-green-dark uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="mt-1.5 text-[28px] font-extrabold tracking-[-.04em] text-nb-ink sm:text-[32px]">
            {t("title")}
          </h1>
          <p className="mt-1 text-[13px] text-stone-600">{t("description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPanel("settings")}
            className="inline-flex items-center gap-2 rounded-full border border-nb-line bg-white/60 px-4 py-2.5 text-xs font-semibold text-nb-ink hover:bg-white"
          >
            <Settings2 size={15} />
            {t("settings")}
          </button>
          <button
            type="button"
            onClick={() => setPanel("planner")}
            className="nb-btn-pill inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"
          >
            <Sparkles size={15} />
            {t("planWithAI")}
          </button>
        </div>
      </header>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(({ key, value, label, hint, icon: Icon, tone, action }) => (
          <button
            type="button"
            key={key}
            onClick={() => {
              setKind("all");
              action();
              setPage(0);
            }}
            className="flex items-start justify-between gap-2 rounded-2xl border border-nb-line bg-white/65 px-4 py-4 text-left transition-colors hover:border-stone-400 sm:px-5"
          >
            <span>
              <span className="text-[11px] font-medium text-stone-600">{label}</span>
              <strong className="mt-1 block text-[27px] leading-tight font-bold tracking-tight text-nb-ink tabular-nums">
                {overview.isLoading ? "—" : value}
              </strong>
              <span className="mt-1 block text-[10px] text-stone-500">{hint}</span>
            </span>
            <Icon size={17} className={cn("mt-0.5 shrink-0", tone)} />
          </button>
        ))}
      </div>
      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_292px]">
        <section
          aria-label={t("agenda")}
          className="min-w-0 overflow-hidden rounded-2xl border border-nb-line bg-white/75 shadow-[0_4px_20px_-12px_rgba(0,0,0,.08)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-nb-line px-4 pt-4 sm:px-6">
            <nav aria-label={t("stageFilter")} className="flex flex-wrap gap-4 sm:gap-6">
              {tabs.map(({ id, icon: Icon, label }) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={kind === id}
                  onClick={() => {
                    setKind(id);
                    setPage(0);
                  }}
                  className={cn(
                    "-mb-px inline-flex items-center gap-2 border-b-2 border-transparent pb-3.5 text-xs font-semibold",
                    kind === id ? "border-nb-ink text-nb-ink" : "text-stone-500 hover:text-nb-ink",
                  )}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </nav>
            <div className="mb-3 flex items-center gap-2 text-[10px] text-stone-500">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  overview.hasError ? "bg-amber-500" : "bg-nb-green-dark",
                )}
              />
              <span>{overview.hasError ? t("partialData") : t("autoUpdate")}</span>
              <button
                type="button"
                aria-label={t("refresh")}
                disabled={overview.isFetching}
                onClick={() => {
                  void overview.refresh();
                }}
                className="rounded-lg p-1.5 hover:bg-stone-100 disabled:opacity-50"
              >
                <RefreshCw
                  size={12}
                  className={cn(overview.isFetching && "motion-safe:animate-spin")}
                />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-3 border-b border-nb-line bg-white/40 px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-nb-line bg-stone-50 p-0.5">
                  {(["day", "week", "all"] as const).map((value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={range === value}
                      onClick={() => {
                        setRange(value);
                        setPage(0);
                      }}
                      className={cn(
                        "rounded-[9px] px-3 py-1.5 text-[11px] font-semibold",
                        range === value ? "bg-white text-nb-ink shadow-sm" : "text-stone-500",
                      )}
                    >
                      {t(`ranges.${value}`)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDay(dateInZone(Date.now(), zone));
                    setRange("day");
                    setPage(0);
                  }}
                  className="rounded-lg px-2 py-2 text-xs font-semibold text-nb-ink hover:bg-stone-50"
                >
                  {t("today")}
                </button>
              </div>
              <select
                aria-label={t("timezone")}
                value={zone}
                onChange={(e) => {
                  setZone(e.target.value);
                  setPage(0);
                }}
                className="min-w-0 bg-transparent py-1 text-[10px] text-stone-500 outline-none"
              >
                <option value={ZONE}>{t("boliviaZone")}</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={t("previous")}
                  onClick={() => {
                    setDay(shiftDay(day, range === "week" ? -7 : -1));
                    setPage(0);
                  }}
                  className="rounded-lg p-1.5 hover:bg-stone-100"
                >
                  <ChevronLeft size={15} />
                </button>
                <label>
                  <span className="sr-only">{t("selectDate")}</span>
                  <input
                    type="date"
                    value={day}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDay(e.target.value);
                        setPage(0);
                      }
                    }}
                    className={cn(FIELD, "w-[140px] font-medium")}
                  />
                </label>
                <button
                  type="button"
                  aria-label={t("next")}
                  onClick={() => {
                    setDay(shiftDay(day, range === "week" ? 7 : 1));
                    setPage(0);
                  }}
                  className="rounded-lg p-1.5 hover:bg-stone-100"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
              <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-1">
                <div className="relative min-w-0 flex-1 sm:max-w-[200px]">
                  <Search
                    size={13}
                    className="pointer-events-none absolute top-3 left-3 text-stone-400"
                  />
                  <input
                    aria-label={t("search")}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                    placeholder={t("searchPlaceholder")}
                    className={cn(FIELD, "w-full pl-8")}
                  />
                </div>
                <select
                  aria-label={t("statusFilter")}
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as typeof status);
                    setPage(0);
                  }}
                  className={cn(FIELD, "max-w-[150px]")}
                >
                  {(["all", "active", "attention", "upcoming"] as const).map((value) => (
                    <option key={value} value={value}>
                      {t(`filters.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 bg-stone-50/70 px-4 py-2.5 sm:px-6">
            <h2 className="text-[11px] font-semibold text-stone-600 capitalize">
              {range === "all"
                ? t("allDates")
                : range === "week"
                  ? t("weekFrom", { date: dateLabel })
                  : dateLabel}
            </h2>
            <span className="text-[10px] text-stone-500">
              {t("eventCount", { count: filtered.length })}
            </span>
          </div>
          {overview.hasError && (
            <div
              role="alert"
              className="border-y border-amber-100 bg-amber-50 px-6 py-2 text-xs text-amber-800"
            >
              {t("loadError")}
            </div>
          )}
          <div
            className="max-h-[420px] overflow-y-auto overscroll-contain xl:max-h-[max(240px,calc(100dvh-720px))]"
            aria-busy={overview.isLoading}
          >
            {overview.isLoading && !overview.events.length ? (
              <div className="space-y-4 p-6" role="status" aria-label={t("loading")}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 motion-safe:animate-pulse rounded-xl bg-stone-100" />
                ))}
              </div>
            ) : visible.length ? (
              visible.map((event) => (
                <AgendaRow
                  key={event.id}
                  event={event}
                  zone={zone}
                  category={categoryName(event.category)}
                  onOpen={() => setSelectedId(event.id)}
                />
              ))
            ) : (
              <div className="flex min-h-[245px] flex-col items-center justify-center px-6 py-9 text-center">
                <CalendarDays size={30} strokeWidth={1.25} className="text-stone-300" />
                <h3 className="mt-4 text-sm font-semibold text-nb-ink">{t("emptyTitle")}</h3>
                <p className="mt-2 max-w-sm text-xs leading-relaxed text-stone-500">
                  {t("emptyDescription")}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRange("all");
                    setStatus("all");
                    setSearch("");
                    setPage(0);
                  }}
                  className="mt-4 text-xs font-semibold text-nb-green-dark underline-offset-4 hover:underline"
                >
                  {t("showEverything")}
                </button>
              </div>
            )}
          </div>
          <footer className="flex items-center justify-between gap-2 border-t border-nb-line px-4 py-3 sm:px-6">
            <p className="text-[10px] text-stone-500">
              {t("pageCount", { page: currentPage + 1, total: pageCount })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
                className="rounded-lg border border-nb-line p-1.5 disabled:opacity-30"
                aria-label={t("previousPage")}
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                disabled={currentPage + 1 >= pageCount}
                onClick={() => setPage(currentPage + 1)}
                className="rounded-lg border border-nb-line p-1.5 disabled:opacity-30"
                aria-label={t("nextPage")}
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </footer>
        </section>
        <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <section className="rounded-2xl border border-nb-line bg-white/65 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-bold text-nb-ink">{t("liveHeading")}</h2>
              <Activity size={15} className="text-nb-green-dark" />
            </div>
            <p className="mt-1 text-[11px] text-stone-500">{t("liveDescription")}</p>
            {active.length ? (
              <div className="mt-4 max-h-48 space-y-3 overflow-y-auto">
                {active.slice(0, 5).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedId(event.id)}
                    className="block w-full rounded-xl border border-nb-line/70 bg-white/70 p-3 text-left"
                  >
                    <p className="truncate text-xs font-semibold">{event.title}</p>
                    <p className="mt-1 text-[10px] text-stone-500">
                      <AgendaPhase event={event} />
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-nb-green/10 px-3 py-3">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-nb-green-dark" />
                <p className="text-xs leading-relaxed text-stone-600">{t("idle")}</p>
              </div>
            )}
            <p className="mt-3 text-[10px] leading-relaxed text-stone-500">{t("pollingHint")}</p>
          </section>
          <section className="rounded-2xl border border-nb-line bg-white/65 p-5">
            <h2 className="text-[13px] font-bold">{t("flowHeading")}</h2>
            <div className="mt-4 space-y-4">
              {[
                { icon: Sparkles, key: "preparation" },
                { icon: Film, key: "render" },
                { icon: Upload, key: "publication" },
              ].map(({ icon: Icon, key }, i) => (
                <div key={key} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                    <Icon size={13} />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold">
                      {i + 1}. {t(`kinds.${key}`)}
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-stone-500">
                      {t(`flow.${key}`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <button
            type="button"
            onClick={() => setPanel("settings")}
            className="flex items-center gap-3 rounded-2xl border border-nb-line bg-white/50 p-4 text-left sm:col-span-2 xl:col-span-1"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-nb-green/15 text-nb-green-dark">
              <Clock3 size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold">{t("recurringHeading")}</span>
              <span className="mt-1 block text-[10px] text-stone-500">
                {t("activeSchedules", {
                  count: overview.categories.flatMap((c) => c.slots).filter((s) => s.enabled)
                    .length,
                })}
              </span>
            </span>
            <ArrowRight size={14} className="text-stone-400" />
          </button>
        </aside>
      </div>
      <p className="mt-4 text-[10px] leading-relaxed text-stone-500">{t("footerNote")}</p>
      {selected && (
        <AgendaDetails
          event={selected}
          events={overview.events}
          zone={zone}
          onClose={() => setSelectedId(null)}
        />
      )}
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl bg-nb-surface p-5 text-nb-ink sm:max-w-[960px] sm:p-7">
          <DialogHeader className="pr-7">
            <DialogTitle className="text-xl font-bold tracking-tight">
              {panel === "planner" ? t("planWithAI") : t("settingsTitle")}
            </DialogTitle>
            <DialogDescription>
              {panel === "planner" ? t("plannerIntro") : t("settingsIntro")}
            </DialogDescription>
          </DialogHeader>
          {panel === "planner" ? (
            <PlannerSection />
          ) : (
            <>
              <div className="flex gap-2 border-b border-nb-line pb-3">
                {(["categories", "slots"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={settingsTab === id}
                    onClick={() => setSettingsTab(id)}
                    className={cn(
                      "rounded-full px-4 py-2 text-xs font-semibold",
                      settingsTab === id ? "bg-nb-ink text-white" : "bg-white/50 text-stone-600",
                    )}
                  >
                    {t(`settingsTabs.${id}`)}
                  </button>
                ))}
              </div>
              {settingsTab === "categories" ? (
                <CategoryAutomationSection />
              ) : (
                <ScheduleSlotsSection />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
