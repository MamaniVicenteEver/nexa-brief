import { Activity, Clapperboard, FileText, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { DashboardWork } from "../lib/operations";
import styles from "./dashboard.module.css";
import { Panel } from "./Panel";

const ICONS = {
  preparation: FileText,
  render: Clapperboard,
  publication: Upload,
  pipeline: Activity,
};

function WorkRow({ item }: { item: DashboardWork }) {
  const t = useTranslations("dashboard.operations");
  const phase = useTranslations("schedule.dashboard");
  const Icon = ICONS[item.kind];
  const phaseKey = `phases.${item.phase}`;
  return (
    <li className={styles.row}>
      <span className={styles.icon}>
        <Icon size={15} aria-hidden />
      </span>
      <div className={styles.grow}>
        <Link className={styles.rowTitle} href={item.href}>
          {item.title}
        </Link>
        <span className={styles.rowMeta}>
          {t(`kinds.${item.kind}`)}
          {item.category && ` · ${item.category}`}
        </span>
        <span className={styles.rowMeta}>
          {item.status === "queued"
            ? t("waiting")
            : item.kind === "pipeline"
              ? t("pipelineStage", {
                  stage: t.has(`stages.${item.phase}`) ? t(`stages.${item.phase}`) : t("running"),
                })
              : phase.has(phaseKey)
                ? phase(phaseKey)
                : t("running")}
        </span>
        {item.progress !== null && (
          <progress
            aria-label={t("progress", { title: item.title })}
            className={styles.progress}
            max={100}
            value={item.progress}
          />
        )}
      </div>
      <span
        className={`${styles.badge} ${item.status === "active" ? styles.activeBadge : styles.pausedBadge}`}
      >
        <span className={styles.activeDot} aria-hidden />
        {item.progress !== null ? `${item.progress} %` : t(item.status)}
      </span>
    </li>
  );
}

export function CurrentWorkPanel({
  work,
  loading,
  hasError,
}: {
  work: DashboardWork[];
  loading: boolean;
  hasError: boolean;
}) {
  const t = useTranslations("dashboard.operations");
  return (
    <Panel
      title={t("title")}
      action={{ label: t("schedule"), href: "/programacion" }}
      className={styles.operationPanel}
    >
      {hasError && (
        <p role="status" className={`${styles.notice} mb-4`}>
          {t("partialError")}
        </p>
      )}
      {loading ? (
        <p className={styles.compactEmpty}>{t("loading")}</p>
      ) : work.length === 0 ? (
        <p className={styles.compactEmpty}>{t(hasError ? "unavailable" : "empty")}</p>
      ) : (
        <>
          <ul className={styles.list}>
            {work.slice(0, 4).map((item) => (
              <WorkRow key={item.id} item={item} />
            ))}
          </ul>
          {work.length > 4 && (
            <details className={styles.disclosure}>
              <summary>{t("more", { count: work.length - 4 })}</summary>
              <ul className={styles.list}>
                {work.slice(4).map((item) => (
                  <WorkRow key={item.id} item={item} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Panel>
  );
}
