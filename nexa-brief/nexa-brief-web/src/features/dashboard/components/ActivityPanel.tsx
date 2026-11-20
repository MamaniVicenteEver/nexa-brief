import { CheckCircle2, Send, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PLATFORM_META } from "@/features/channels/constants/platforms";
import { type ActivityItem, relativeTime } from "@/features/stats";
import { Link } from "@/i18n/navigation";
import { timestamp } from "../lib/operations";
import styles from "./dashboard.module.css";
import { EmptyNote, Panel } from "./Panel";

const ICONS = { video_ready: CheckCircle2, video_failed: XCircle, published: Send };
function ActivityRow({ item, zone }: { item: ActivityItem; zone: string }) {
  const t = useTranslations("dashboard.activity");
  const locale = useLocale();
  const Icon = ICONS[item.kind];
  const title =
    item.kind === "published" && item.url ? (
      <a href={item.url} target="_blank" rel="noreferrer" className={styles.rowTitle}>
        {item.title}
      </a>
    ) : item.jobId ? (
      <Link href={`/biblioteca/${item.jobId}`} className={styles.rowTitle}>
        {item.title}
      </Link>
    ) : (
      <span className={styles.rowTitle}>{item.title}</span>
    );
  return (
    <li className={styles.row}>
      <span className={styles.icon}>
        <Icon size={15} aria-hidden />
      </span>
      <div className={styles.grow}>
        {title}
        <span className={styles.rowMeta}>
          {t(`kinds.${item.kind}`, {
            platform: item.platform ? (PLATFORM_META[item.platform]?.label ?? item.platform) : "",
          })}
        </span>
        <time dateTime={item.at} className={styles.rowMeta}>
          {timestamp(item.at, locale, zone)}
        </time>
      </div>
      <span className={`${styles.time} hidden sm:block`}>{relativeTime(item.at, locale)}</span>
    </li>
  );
}
export function ActivityPanel({ activity, zone }: { activity: ActivityItem[]; zone: string }) {
  const t = useTranslations("dashboard.activity");
  return (
    <Panel title={t("title")} action={{ label: t("history"), href: "/historial" }}>
      {activity.length === 0 ? (
        <EmptyNote>{t("empty")}</EmptyNote>
      ) : (
        <>
          <ol className={styles.list}>
            {activity.slice(0, 5).map((item) => (
              <ActivityRow
                key={`${item.kind}-${item.at}-${item.jobId}-${item.platform}-${item.url ?? item.title}`}
                item={item}
                zone={zone}
              />
            ))}
          </ol>
          {activity.length > 5 && (
            <details className={styles.disclosure}>
              <summary>{t("more", { count: activity.length - 5 })}</summary>
              <ol className={styles.list}>
                {activity.slice(5).map((item) => (
                  <ActivityRow
                    key={`${item.kind}-${item.at}-${item.jobId}-${item.platform}-${item.url ?? item.title}`}
                    item={item}
                    zone={zone}
                  />
                ))}
              </ol>
            </details>
          )}
        </>
      )}
    </Panel>
  );
}
