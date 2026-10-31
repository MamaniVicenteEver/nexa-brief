import { useTranslations } from "next-intl";
import { PlatformIcon } from "@/features/channels/components/PlatformIcon";
import { PLATFORM_META } from "@/features/channels/constants/platforms";
import type { PublicationStats } from "@/features/stats";
import { Panel } from "./Panel";

function getPlatformMeta(platform: string): { label: string; color: string } {
  const meta = PLATFORM_META[platform as keyof typeof PLATFORM_META];
  return meta ?? { label: platform || "Otra plataforma", color: "#737373" };
}

export function PublicationsPanel({ publications }: { publications: PublicationStats }) {
  const t = useTranslations("dashboard.publications");
  const max = Math.max(1, ...publications.byPlatform.map((p) => p.total));
  return (
    <Panel title={t("title")}>
      <div className="flex items-baseline gap-2">
        <span className="font-nb-sans text-[40px] leading-none font-extrabold tracking-[-0.04em] text-nb-ink tabular-nums">
          {publications.total}
        </span>
        <span className="text-[12.5px] text-nb-mute">
          {t("last30", { count: publications.last30Days })}
        </span>
      </div>
      <ul className="mt-5 flex flex-col gap-4">
        {publications.byPlatform.map(({ platform, total, last7Days }) => (
          <li key={platform} className="flex items-center gap-3">
            <PlatformIcon platform={platform} className="size-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="font-semibold text-nb-ink">{getPlatformMeta(platform).label}</span>
                <span className="text-nb-mute">
                  <span className="font-bold text-nb-ink tabular-nums">{total}</span>
                  {last7Days > 0 && ` · +${last7Days} ${t("thisWeek")}`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-nb-bg-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${total ? Math.max(6, (total / max) * 100) : 0}%`,
                    background: getPlatformMeta(platform).color,
                  }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
