import { useTranslations } from "next-intl";
import { PlatformIcon } from "@/features/channels/components/PlatformIcon";
import { PLATFORM_META } from "@/features/channels/constants/platforms";
import type { PublicationStats } from "@/features/stats";
import styles from "./dashboard.module.css";
import { EmptyNote, Panel } from "./Panel";

export function PublicationsPanel({ publications }: { publications: PublicationStats }) {
  const t = useTranslations("dashboard.publications");
  const max = Math.max(1, ...publications.byPlatform.map((p) => p.total));
  return (
    <Panel title={t("title")} description={t("description")}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <strong className={styles.bigNumber}>{publications.total}</strong>
        <span className={styles.description}>
          {t("last30", { count: publications.last30Days })}
        </span>
      </div>
      {publications.byPlatform.length === 0 ? (
        <EmptyNote>{t("empty")}</EmptyNote>
      ) : (
        <ul className="mt-3">
          {publications.byPlatform.map(({ platform, total, last7Days }) => (
            <li className={styles.platformRow} key={platform}>
              <PlatformIcon
                platform={platform}
                tone="neutral"
                className="size-6"
                rounded="rounded-md"
              />
              <span className="text-xs font-medium">
                {PLATFORM_META[platform]?.label ?? platform}
              </span>
              <span className="text-xs tabular-nums">
                <strong className="font-semibold">{total}</strong>
                <span className="text-nb-mute"> · {t("weekly", { count: last7Days })}</span>
              </span>
              <span className={styles.bar}>
                <span
                  style={{
                    width: `${(total / max) * 100}%`,
                    background: PLATFORM_META[platform]?.color,
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
