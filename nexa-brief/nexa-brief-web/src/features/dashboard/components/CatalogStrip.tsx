import { Cpu, Layers, LayoutTemplate, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CatalogStats, VideoStats } from "@/features/stats";
import { formatDurationShort } from "@/features/stats";
import { Link } from "@/i18n/navigation";
import styles from "./dashboard.module.css";
export function CatalogStrip({ catalog, videos }: { catalog: CatalogStats; videos: VideoStats }) {
  const t = useTranslations("dashboard.catalog");
  const items = [
    {
      Icon: LayoutTemplate,
      value: catalog.templates,
      label: t("templates", { lyric: catalog.lyricTemplates, visual: catalog.visualTemplates }),
      href: "/plantillas",
    },
    { Icon: Layers, value: catalog.activeNiches, label: t("niches"), href: "/crear-video" },
    {
      Icon: Cpu,
      value: catalog.engines.length,
      label: catalog.engines.join(" · "),
      href: "/crear-video",
    },
    {
      Icon: Video,
      value: formatDurationShort(videos.videoSeconds),
      label: t("produced"),
      href: "/biblioteca",
    },
  ];
  return (
    <nav className={styles.catalog} aria-label={t("label")}>
      {items.map(({ Icon, value, label, href }) => (
        <Link key={href + label} href={href}>
          <Icon size={17} className="mt-1 text-nb-mute" aria-hidden />
          <span>
            <strong>{value}</strong>
            <span>{label}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
