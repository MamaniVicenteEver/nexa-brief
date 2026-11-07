import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { PLATFORM_META } from "@/features/channels/constants/platforms";
import type { AgendaEvent } from "@/features/schedule/lib/agenda";
import type { DashboardAlert } from "@/features/stats";
import { Link } from "@/i18n/navigation";
import type { CategoryOverview } from "../api/categories-overview";
import styles from "./dashboard.module.css";
import { Panel } from "./Panel";

function hrefFor(alert: DashboardAlert): string {
  if (alert.kind === "reauth" || alert.kind === "token_expiring") return "/canales";
  return alert.jobId ? `/biblioteca/${alert.jobId}` : "/biblioteca?tab=fallidos";
}
export function AlertsPanel({
  alerts,
  categories,
  failures,
  incomplete,
}: {
  alerts: DashboardAlert[];
  categories: CategoryOverview[];
  failures: AgendaEvent[];
  incomplete: boolean;
}) {
  const t = useTranslations("dashboard.alerts");
  const affected = categories.filter((c) => c.missing.includes("autopublish_off"));
  const total = alerts.length + failures.length + (affected.length ? 1 : 0);
  const alertRows = alerts.map((alert) => (
    <li
      className={styles.row}
      key={`${alert.kind}-${alert.jobId}-${alert.platform}-${alert.accountAlias}`}
    >
      <CircleAlert size={15} className="mt-1" aria-hidden />
      <div className={styles.grow}>
        <p className={styles.rowTitle}>
          {t(`kinds.${alert.kind}`, {
            platform: alert.platform
              ? (PLATFORM_META[alert.platform]?.label ?? alert.platform)
              : "",
            account: alert.accountAlias ?? "",
            title: alert.title ?? "",
          })}
        </p>
        {alert.detail && (
          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-nb-mute">{t("details")}</summary>
            <p className={`${styles.rowMeta} whitespace-pre-wrap`}>{alert.detail}</p>
          </details>
        )}
      </div>
      <Link href={hrefFor(alert)} className={styles.textLink}>
        {t("resolve")} →
      </Link>
    </li>
  ));
  for (const event of failures) {
    alertRows.push(
      <li key={event.id} className={styles.row}>
        <CircleAlert size={15} className="mt-1" aria-hidden />
        <div className={styles.grow}>
          <p className={styles.rowTitle}>
            {t(event.kind === "render" ? "recordingFailed" : "preparationFailed", {
              title: event.title,
            })}
          </p>
          {event.error && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-nb-mute">{t("details")}</summary>
              <p className={`${styles.rowMeta} whitespace-pre-wrap`}>{event.error}</p>
            </details>
          )}
        </div>
        <Link
          href={
            event.recording?.scheduledJobId
              ? `/biblioteca/${event.recording.scheduledJobId}`
              : "/programacion"
          }
          className={styles.textLink}
        >
          {t("resolve")} →
        </Link>
      </li>,
    );
  }
  return (
    <div id="dashboard-attention" className="scroll-mt-24">
      {total === 0 ? (
        <p className={styles.notice}>{t(incomplete ? "incomplete" : "clear")}</p>
      ) : (
        <Panel title={t("title", { count: total })} className={styles.attention}>
          <ul className={styles.list}>
            {affected.length > 0 && (
              <li className={styles.row}>
                <CircleAlert size={15} className="mt-1" aria-hidden />
                <div className={styles.grow}>
                  <p className={styles.rowTitle}>{t("automationOff")}</p>
                  <p className={styles.rowMeta}>
                    {t("automationAffected", {
                      categories: affected.map((c) => c.displayName).join(", "),
                    })}
                  </p>
                </div>
                <Link href="/programacion" className={styles.textLink}>
                  {t("review")} →
                </Link>
              </li>
            )}
            {alertRows.slice(0, 3)}
          </ul>
          {alertRows.length > 3 && (
            <details className={styles.disclosure}>
              <summary>{t("more", { count: alertRows.length - 3 })}</summary>
              <ul className={styles.list}>{alertRows.slice(3)}</ul>
            </details>
          )}
        </Panel>
      )}
    </div>
  );
}
