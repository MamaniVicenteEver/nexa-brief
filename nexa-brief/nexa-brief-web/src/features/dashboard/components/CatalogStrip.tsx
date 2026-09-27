import { Cpu, LayoutTemplate, Layers, Music2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CatalogStats, VideoStats } from "@/features/stats";
import { formatDurationShort } from "@/features/stats";
import { Link } from "@/i18n/navigation";

export function CatalogStrip({ catalog, videos }: { catalog: CatalogStats; videos: VideoStats }) {
  const t = useTranslations("dashboard.catalog");
  const items = [
    {
      Icon: LayoutTemplate,
      value: catalog.templates,
      label: t("templates", { lyric: catalog.lyricTemplates }),
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
      Icon: Music2,
      value: formatDurationShort(videos.videoSeconds),
      label: t("produced"),
      href: "/biblioteca",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(({ Icon, value, label, href }) => (
        <Link
          key={label}
          href={href}
          className="flex items-center gap-3 rounded-[20px] border border-nb-line px-4 py-3.5 no-underline transition-colors hover:bg-nb-surface"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-nb-bg-2 text-nb-ink-soft">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-nb-sans text-[18px] leading-tight font-extrabold text-nb-ink">
              {value}
            </span>
            <span className="block truncate text-[11.5px] text-nb-mute">{label}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
