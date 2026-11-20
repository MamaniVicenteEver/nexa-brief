"use client";

import { CalendarDays, Library, Plus, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useScheduleOverview } from "@/features/schedule/hooks/useScheduleOverview";
import { useDashboardSummary } from "@/features/stats";
import { Link } from "@/i18n/navigation";
import { useCategoriesOverview } from "../api/categories-overview";
import { currentWork, operationFailures, timestamp, upcomingWork } from "../lib/operations";
import { ActivityPanel } from "./ActivityPanel";
import { AlertsPanel } from "./AlertsPanel";
import { CatalogStrip } from "./CatalogStrip";
import { ChannelsPanel } from "./ChannelsPanel";
import { CurrentWorkPanel } from "./CurrentWorkPanel";
import styles from "./dashboard.module.css";
import { KpiRow } from "./KpiRow";
import { PerformancePanel } from "./PerformancePanel";
import { PublicationsPanel } from "./PublicationsPanel";
import { UpcomingPanel } from "./UpcomingPanel";

/** Uses the same cached, read-only queries as Scheduling. No model calls or work submission. */
export function DashboardView({ userName }: { userName: string | null }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [zone, setZone] = useState("America/La_Paz");
  const summary = useDashboardSummary();
  const overview = useScheduleOverview();
  const categories = useCategoriesOverview();
  const work = useMemo(
    () => currentWork(overview.events, overview.jobs),
    [overview.events, overview.jobs],
  );
  const failures = useMemo(
    () => operationFailures(overview.events, summary.data?.alerts ?? []),
    [overview.events, summary.data?.alerts],
  );
  const now = summary.dataUpdatedAt || overview.updatedAt || 0;
  const next = useMemo(
    () => upcomingWork(overview.events, summary.data?.upcoming ?? [], now),
    [overview.events, summary.data?.upcoming, now],
  );
  const stamps = [summary.dataUpdatedAt, overview.updatedAt, categories.dataUpdatedAt].filter(
    Boolean,
  );
  const updated = stamps.length ? Math.min(...stamps) : 0;
  const fetching = summary.isFetching || overview.isFetching || categories.isFetching;
  const partialError = summary.isError || overview.hasError || categories.isError;
  const refresh = () => Promise.all([summary.refetch(), overview.refresh(), categories.refetch()]);
  const prepared = categories.data
    ? categories.data.reduce((sum, c) => sum + c.pipeline.readyToRecord, 0)
    : null;
  const globalAlert = categories.data?.some((c) => c.missing.includes("autopublish_off")) ? 1 : 0;
  return (
    <div className={styles.workspace} data-dashboard-workspace>
      <header className={styles.header}>
        <div>
          <h1 className={styles.heading}>
            {userName ? t("greeting", { name: userName }) : t("heading")}
          </h1>
          <p className={styles.subtitle}>{t("subtitle")}</p>
        </div>
        <nav className={styles.actions} aria-label={t("actions.label")}>
          <Link href="/programacion" className={styles.button}>
            <CalendarDays size={15} aria-hidden />
            {t("actions.schedule")}
          </Link>
          <Link href="/biblioteca" className={styles.button}>
            <Library size={15} aria-hidden />
            {t("actions.library")}
          </Link>
          <Link href="/crear-video" className={`${styles.button} ${styles.primary}`}>
            <Plus size={15} aria-hidden />
            {t("actions.create")}
          </Link>
        </nav>
      </header>
      <div className={styles.meta}>
        <div className={styles.metaGroup}>
          <span>
            {now
              ? timestamp(now / 1000, locale, zone, { hour: undefined, minute: undefined })
              : "—"}
          </span>
          <label className={styles.zone}>
            {t("timezone")}
            <select className={styles.field} value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="America/La_Paz">{t("bolivia")}</option>
              <option value="UTC">UTC</option>
            </select>
          </label>
        </div>
        <div className={styles.metaGroup}>
          <span role="status">
            {partialError
              ? t("partialError")
              : updated
                ? t("updated", {
                    time: timestamp(updated / 1000, locale, zone, {
                      day: undefined,
                      month: undefined,
                      year: undefined,
                    }),
                  })
                : t("loading")}
          </span>
          <button
            type="button"
            className={styles.smallButton}
            disabled={fetching}
            onClick={refresh}
          >
            <RefreshCw size={13} aria-hidden />
            {t("refresh")}
          </button>
        </div>
      </div>
      <div className={styles.stack}>
        {summary.isLoading ? (
          <div className={styles.skeleton} role="status" aria-label={t("loading")} />
        ) : summary.data ? (
          <>
            <KpiRow
              videos={summary.data.videos}
              preparing={
                overview.isLoading || overview.hasError
                  ? null
                  : work.filter((w) => w.kind === "preparation" || w.kind === "pipeline").length
              }
              prepared={prepared}
              recording={
                overview.isLoading || overview.hasError
                  ? null
                  : work.filter((w) => w.kind === "render").length
              }
              issues={summary.data.alerts.length + globalAlert + failures.length}
            />
            <p className={`${styles.description} ${styles.librarySummary}`}>
              {t("libraryOverview", {
                total: summary.data.videos.total,
                processing: summary.data.videos.processing,
                failed: summary.data.videos.failed,
              })}{" "}
              <Link href="/biblioteca?tab=fallidos" className={styles.textLink}>
                {t("reviewLibrary")} →
              </Link>
            </p>
          </>
        ) : (
          <p className={styles.notice} role="alert">
            {t("loadError")}
          </p>
        )}
        <div className={styles.operations}>
          <CurrentWorkPanel work={work} loading={overview.isLoading} hasError={overview.hasError} />
          <UpcomingPanel
            events={next}
            zone={zone}
            zoneLabel={zone === "UTC" ? "UTC" : t("bolivia")}
            now={now}
            loading={overview.isLoading}
            hasError={overview.hasError || summary.isError}
          />
        </div>
        {summary.data && (
          <AlertsPanel
            alerts={summary.data.alerts}
            categories={categories.data ?? []}
            failures={failures}
            incomplete={summary.isError || overview.hasError || categories.isError}
          />
        )}
        {summary.data && (
          <>
            <ChannelsPanel channels={summary.data.channelList} zone={zone} />
            <div className={styles.operations}>
              <ActivityPanel activity={summary.data.activity} zone={zone} />
              <div className="flex min-w-0 flex-col gap-6">
                <PublicationsPanel publications={summary.data.publications} />
                <PerformancePanel performance={summary.data.performance} />
              </div>
            </div>
            <CatalogStrip catalog={summary.data.catalog} videos={summary.data.videos} />
          </>
        )}
      </div>
    </div>
  );
}
