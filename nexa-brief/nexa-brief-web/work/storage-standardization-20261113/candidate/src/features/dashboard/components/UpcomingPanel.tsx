import { CalendarDays } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { AgendaEvent } from "@/features/schedule/lib/agenda";
import { Link } from "@/i18n/navigation";
import { timestamp } from "../lib/operations";
import styles from "./dashboard.module.css";
import { Panel } from "./Panel";

function UpcomingRow({ event, zone, now }: { event: AgendaEvent; zone: string; now: number }) {
  const t = useTranslations("dashboard.next");
  const locale = useLocale();
  const date = event.at ? new Date(event.at) : null;
  const overdue = date && date.getTime() < now && event.status === "scheduled";
  return (
    <li className={styles.row}>
      <span className={styles.icon}>
        <CalendarDays size={15} aria-hidden />
      </span>
      <div className={styles.grow}>
        <Link href="/programacion" className={styles.rowTitle}>
          {event.title}
        </Link>
        <span className={styles.rowMeta}>
          {t(`kinds.${event.kind}`)}
          {event.publication
            ? ` · ${event.publication.platform} · @${event.publication.accountAlias}`
            : event.category
              ? ` · ${event.category}`
              : ""}
        </span>
        {overdue && <span className={styles.rowMeta}>{t("overdue")}</span>}
      </div>
      <time
        dateTime={event.at ?? undefined}
        title={timestamp(event.at, locale, zone)}
        className={styles.time}
      >
        <strong>
          {date
            ? new Intl.DateTimeFormat(locale, {
                timeZone: zone,
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
              }).format(date)
            : "—"}
        </strong>
        {date
          ? new Intl.DateTimeFormat(locale, {
              timeZone: zone,
              day: "2-digit",
              month: "short",
              year: "numeric",
            }).format(date)
          : "—"}
      </time>
    </li>
  );
}
export function UpcomingPanel({
  events,
  zone,
  zoneLabel,
  now,
  loading,
  hasError,
}: {
  events: AgendaEvent[];
  zone: string;
  zoneLabel: string;
  now: number;
  loading: boolean;
  hasError: boolean;
}) {
  const t = useTranslations("dashboard.next");
  return (
    <Panel
      title={t("title")}
      action={{ label: t("schedule"), href: "/programacion" }}
      className={styles.operationPanel}
    >
      {loading ? (
        <p className={styles.compactEmpty}>{t("loading")}</p>
      ) : events.length === 0 ? (
        <p className={styles.compactEmpty}>{t(hasError ? "unavailable" : "empty")}</p>
      ) : (
        <>
          <ul className={styles.list}>
            {events.slice(0, 4).map((event) => (
              <UpcomingRow key={event.id} event={event} zone={zone} now={now} />
            ))}
          </ul>
          {events.length > 4 && (
            <details className={styles.disclosure}>
              <summary>{t("more", { count: events.length - 4 })}</summary>
              <ul className={styles.list}>
                {events.slice(4).map((event) => (
                  <UpcomingRow key={event.id} event={event} zone={zone} now={now} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {events.length > 0 && (
        <p className={`${styles.description} mt-3`}>{t("zone", { zone: zoneLabel })}</p>
      )}
      {events.some((e) => e.kind === "plan") && (
        <p className={styles.description}>{t("editorialHint")}</p>
      )}
    </Panel>
  );
}
