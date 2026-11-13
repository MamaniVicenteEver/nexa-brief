import { CircleAlert, Clapperboard, FileCheck2, FileText, Send, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import type { VideoStats } from "@/features/stats";
import { Link } from "@/i18n/navigation";
import styles from "./dashboard.module.css";

export function KpiRow({
  videos,
  preparing,
  prepared,
  recording,
  issues,
}: {
  videos: VideoStats;
  preparing: number | null;
  prepared: number | null;
  recording: number | null;
  issues: number;
}) {
  const t = useTranslations("dashboard.metrics");
  const metrics = [
    { key: "preparing", value: preparing, href: "/programacion", Icon: FileText },
    { key: "prepared", value: prepared, href: "/plantillas", Icon: FileCheck2 },
    { key: "recording", value: recording, href: "/programacion", Icon: Clapperboard },
    { key: "ready", value: videos.ready, href: "/biblioteca?tab=pendientes", Icon: Upload },
    { key: "published", value: videos.published, href: "/biblioteca?tab=publicados", Icon: Send },
    { key: "issues", value: issues, href: "#dashboard-attention", Icon: CircleAlert },
  ];
  return (
    <nav className={styles.kpis} aria-label={t("label")}>
      {metrics.map(({ key, value, href, Icon }) => (
        <Link
          key={key}
          href={href}
          className={styles.kpi}
          title={t(`${key}Hint`)}
          aria-label={`${t(key)}: ${value ?? "—"}. ${t(`${key}Hint`)}`}
        >
          <Icon size={15} strokeWidth={1.6} aria-hidden />
          <span className={styles.kpiLabel}>{t(key)}</span>
          <strong className={styles.kpiValue}>{value ?? "—"}</strong>
        </Link>
      ))}
    </nav>
  );
}
