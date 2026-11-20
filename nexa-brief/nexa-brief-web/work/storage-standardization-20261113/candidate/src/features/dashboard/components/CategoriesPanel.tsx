import { CalendarClock, Clapperboard, FileText, Film, Search, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { PlatformIcon } from "@/features/channels/components/PlatformIcon";
import { PLATFORM_META } from "@/features/channels/constants/platforms";
import type { ChannelPlatform } from "@/features/channels/types";
import { Link } from "@/i18n/navigation";
import type { CategoryOverview } from "../api/categories-overview";
import { timestamp } from "../lib/operations";
import styles from "./dashboard.module.css";
import { EmptyNote, Panel } from "./Panel";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
function CategoryCard({ category, zone }: { category: CategoryOverview; zone: string }) {
  const t = useTranslations("dashboard.categories");
  const locale = useLocale();
  const off = category.missing.includes("autopublish_off");
  const gaps = category.missing.filter((g) => g !== "autopublish_off");
  const ready = !off && gaps.length === 0;
  const stats = [
    { key: "producing", Icon: FileText },
    { key: "readyToRecord", Icon: Clapperboard },
    { key: "recordedPending", Icon: Film },
    { key: "published", Icon: Send },
  ] as const;
  return (
    <article className={styles.categoryCard}>
      <header className={styles.cardHeader}>
        <div className={styles.grow}>
          <h3 className={styles.cardTitle}>{category.displayName}</h3>
          <p className={styles.categoryTopic}>{category.topic}</p>
        </div>
        <span className={`${styles.badge} ${ready ? styles.activeBadge : styles.pausedBadge}`}>
          {ready ? t("autopilot") : off ? t("disabled") : t("setup")}
        </span>
      </header>
      <div className={styles.categoryStats}>
        {stats.map(({ key, Icon }) => (
          <div key={key}>
            <Icon size={14} strokeWidth={1.6} aria-hidden />
            <strong>{category.pipeline[key]}</strong>
            <span>{t(`funnel.${key}`)}</span>
          </div>
        ))}
      </div>
      <p className="flex items-start gap-2 text-xs leading-relaxed text-nb-mute">
        <CalendarClock size={14} className="mt-0.5" aria-hidden />
        <span>
          {category.schedule.nextAt
            ? timestamp(category.schedule.nextAt, locale, zone)
            : t("noSchedule")}
        </span>
      </p>
      <details className={styles.cardDetails}>
        <summary aria-label={t("detailsFor", { category: category.displayName })}>
          {t("details")}
        </summary>
        <div>
          <h4>{t("contentTitle")}</h4>
          <p>
            {t("designs", { count: category.content.designs })} ·{" "}
            {t("templates", { count: category.content.templates })}
          </p>
          <p>
            {t("engine")}: {category.engine === "explainer_kit" ? t("explainer") : t("pipeline")}
          </p>
          <p>{t("planned", { count: category.automation.plannedItems })}</p>
        </div>
        <div>
          <h4>{t("scheduleTitle")}</h4>
          {category.schedule.channels.length ? (
            <>
              <ul>
                {category.schedule.channels.map((selector) => {
                  const [platform, ...alias] = selector.split(":");
                  return (
                    <li key={selector} className="flex items-center gap-2">
                      <PlatformIcon
                        tone="neutral"
                        platform={platform as ChannelPlatform}
                        className="size-5"
                        rounded="rounded-full"
                      />
                      {PLATFORM_META[platform as ChannelPlatform]?.label ?? platform} · @
                      {alias.join(":")}
                    </li>
                  );
                })}
              </ul>
              <p>
                {category.schedule.days.length === 7
                  ? t("everyDay")
                  : category.schedule.days.map((d) => t(`days.${DAYS[d]}`)).join(" · ")}{" "}
                · {category.schedule.times.join(", ")} UTC
              </p>
            </>
          ) : (
            <p>{t("noSchedule")}</p>
          )}
        </div>
        <div>
          <h4>{t("automationTitle")}</h4>
          <p>
            {t("autoproduce")}: {t(category.automation.autoproduce ? "on" : "off")}
          </p>
          <p>
            {t("prerecord")}: {t(category.automation.prerecord ? "on" : "off")}
          </p>
          {gaps.length > 0 && (
            <ul className="mt-2">
              {gaps.map((gap) => (
                <li key={gap}>{t(`missing.${gap}`)}</li>
              ))}
            </ul>
          )}
          {off && <p className="mt-2">{t("globalOffHint")}</p>}
        </div>
      </details>
      <div className="mt-auto flex flex-wrap gap-2">
        <Link href={`/plantillas?cat=${category.id}`} className={styles.smallButton}>
          {category.engine === "explainer_kit" ? t("create") : t("openTemplates")}
        </Link>
        <Link href="/programacion" className={styles.smallButton}>
          {t("schedule")} →
        </Link>
      </div>
    </article>
  );
}
export function CategoriesPanel({
  categories,
  loading,
  hasError,
  zone,
  zoneLabel,
}: {
  categories: CategoryOverview[];
  loading: boolean;
  hasError: boolean;
  zone: string;
  zoneLabel: string;
}) {
  const t = useTranslations("dashboard.categories");
  const [search, setSearch] = useState("");
  const visible = categories.filter((c) =>
    `${c.displayName} ${c.topic}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <Panel
      title={t("title")}
      description={t("subtitle")}
      action={{ label: t("manage"), href: "/plantillas" }}
    >
      {loading ? (
        <EmptyNote>{t("loading")}</EmptyNote>
      ) : hasError && categories.length === 0 ? (
        <EmptyNote>{t("loadError")}</EmptyNote>
      ) : (
        <>
          <div className={styles.controls}>
            <label className={styles.search}>
              <span className="sr-only">{t("search")}</span>
              <Search size={15} aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search")}
                className={styles.field}
              />
            </label>
            <span className={styles.description}>{t("count", { count: visible.length })}</span>
          </div>
          {visible.length === 0 ? (
            <EmptyNote>{t("noResults")}</EmptyNote>
          ) : (
            <div className={styles.categoryGrid}>
              {visible.map((c) => (
                <CategoryCard key={c.id} category={c} zone={zone} />
              ))}
            </div>
          )}
          <p className={`${styles.description} mt-4`}>{t("countsHint", { zone: zoneLabel })}</p>
        </>
      )}
    </Panel>
  );
}
