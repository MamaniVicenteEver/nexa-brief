import { useTranslations } from "next-intl";
import { formatDurationShort, type PerformanceStats } from "@/features/stats";
import styles from "./dashboard.module.css";
import { EmptyNote, Panel } from "./Panel";

export function PerformancePanel({ performance }: { performance: PerformanceStats }) {
  const t = useTranslations("dashboard.performance");
  const stages = useTranslations("dashboard.operations.stages");
  const max = Math.max(1, ...performance.stages.map((s) => s.avgSeconds));
  const rows = performance.stages.map((stage, index) => (
    <li key={stage.stage} className={styles.timing}>
      <span>{stages.has(stage.stage) ? stages(stage.stage) : stage.stage}</span>
      <span className={styles.bar}>
        <span
          style={{
            width: `${Math.max(0, (stage.avgSeconds / max) * 100)}%`,
            background: index === 0 ? "var(--color-nb-accent-amber)" : "var(--color-nb-green-dark)",
          }}
        />
      </span>
      <span className="text-nb-mute tabular-nums">{formatDurationShort(stage.avgSeconds)}</span>
    </li>
  ));
  return (
    <Panel title={t("title")} description={t("description")}>
      {performance.avgGenerationSeconds === null ? (
        <EmptyNote>{t("empty")}</EmptyNote>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <strong className={styles.bigNumber}>
              {formatDurationShort(performance.avgGenerationSeconds)}
            </strong>
            <span className={styles.description}>
              {t("average", { count: performance.sampleSize })}
            </span>
          </div>
          <ul className={styles.timings}>{rows.slice(0, 4)}</ul>
          {rows.length > 4 && (
            <details className={styles.disclosure}>
              <summary>{t("more", { count: rows.length - 4 })}</summary>
              <ul className={styles.timings}>{rows.slice(4)}</ul>
            </details>
          )}
          {performance.fastestGenerationSeconds !== null && (
            <footer className={styles.footer}>
              {t("fastest", { time: formatDurationShort(performance.fastestGenerationSeconds) })}
            </footer>
          )}
        </>
      )}
    </Panel>
  );
}
