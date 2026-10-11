import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clapperboard,
  Film,
  Send,
  Sparkles,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PlatformIcon } from "@/features/channels/components/PlatformIcon";
import type { ChannelPlatform } from "@/features/channels/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { type CategoryOverview, useCategoriesOverview } from "../api/categories-overview";
import { EmptyNote, Panel } from "./Panel";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Red de canales NODE: una tarjeta por categoría principal con su embudo
 * (producción → listo → grabado → publicado), sus horarios y qué le falta
 * para publicar sola. */
export function CategoriesPanel() {
  const t = useTranslations("dashboard.categories");
  const { data, isLoading, isError } = useCategoriesOverview();

  return (
    <Panel title={t("title")} action={{ label: t("manage"), href: "/plantillas" }}>
      <p className="-mt-2 mb-4 text-[12.5px] text-nb-mute">{t("subtitle")}</p>
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {DAY_KEYS.slice(0, 5).map((k) => (
            <div key={k} className="h-[220px] animate-pulse rounded-[20px] bg-nb-bg-2" />
          ))}
        </div>
      ) : isError || !data ? (
        <EmptyNote>{t("loadError")}</EmptyNote>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function CategoryCard({ category }: { category: CategoryOverview }) {
  const t = useTranslations("dashboard.categories");
  const locale = useLocale();
  const ready = category.missing.length === 0;
  const isExplainer = category.engine === "explainer_kit";
  const funnel = [
    { Icon: Sparkles, value: category.pipeline.producing, label: t("funnel.producing") },
    {
      Icon: Clapperboard,
      value: category.pipeline.readyToRecord,
      label: t("funnel.readyToRecord"),
    },
    { Icon: Film, value: category.pipeline.recordedPending, label: t("funnel.recordedPending") },
    { Icon: Send, value: category.pipeline.published, label: t("funnel.published") },
  ];
  const days =
    category.schedule.days.length === 7
      ? t("everyDay")
      : category.schedule.days.map((d) => t(`days.${DAY_KEYS[d]}`)).join(" · ");

  return (
    <article className="flex flex-col gap-3 rounded-[20px] border border-nb-line bg-white/50 p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-nb-sans text-[16px] font-extrabold tracking-[-0.02em] text-nb-ink">
            {category.displayName}
          </h3>
          <p className="text-[11.5px] text-nb-mute">
            {category.topic} ·{" "}
            {isExplainer
              ? t("designs", { count: category.content.designs })
              : t("templates", { count: category.content.templates })}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase",
            ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800",
          )}
        >
          {ready ? <CheckCircle2 className="size-3" /> : <CircleAlert className="size-3" />}
          {ready ? t("autopilot") : t("setup")}
        </span>
      </header>

      <ul className="grid grid-cols-4 gap-1.5">
        {funnel.map(({ Icon, value, label }) => (
          <li key={label} className="rounded-xl bg-nb-bg-2 px-2 py-2 text-center" title={label}>
            <Icon className="mx-auto size-3.5 text-nb-ink-soft" />
            <span className="block font-nb-sans text-[17px] leading-tight font-extrabold text-nb-ink">
              {value}
            </span>
            <span className="block truncate text-[10px] text-nb-mute">{label}</span>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-nb-line px-3 py-2">
        {category.schedule.channels.length === 0 ? (
          <p className="text-[12px] text-nb-mute">{t("noSchedule")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {category.schedule.channels.map((selector) => {
                const [platform, alias] = selector.split(":");
                return (
                  <span
                    key={selector}
                    className="inline-flex items-center gap-1 rounded-full bg-nb-bg-2 px-2 py-0.5 text-[11px] text-nb-ink-soft"
                  >
                    <PlatformIcon platform={platform as ChannelPlatform} className="size-3.5" />@
                    {alias}
                  </span>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11.5px] text-nb-ink-soft">
              {days} · {category.schedule.times.join(", ")} UTC
            </p>
            {category.schedule.nextAt && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-nb-ink">
                <CalendarClock className="size-3.5" />
                {t("next")}{" "}
                {new Date(category.schedule.nextAt).toLocaleString(locale, {
                  weekday: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </>
        )}
      </div>

      {isExplainer && (
        <p className="text-[11px] text-nb-mute">
          {t("automation", {
            planned: category.automation.plannedItems,
            prerecord: category.automation.prerecord ? t("on") : t("off"),
            autoproduce: category.automation.autoproduce ? t("on") : t("off"),
          })}
        </p>
      )}

      {category.missing.length > 0 && (
        <ul className="flex flex-col gap-1">
          {category.missing.map((gap) => (
            <li key={gap} className="flex items-start gap-1.5 text-[11.5px] text-amber-800">
              <CircleAlert className="mt-px size-3.5 shrink-0" />
              {t(`missing.${gap}`)}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Link
          href={`/plantillas?cat=${category.id}`}
          className="nb-btn-pill px-3.5 py-1.5 text-[12px] font-semibold no-underline"
        >
          {isExplainer ? t("create") : t("openTemplates")}
        </Link>
        <Link
          href="/programacion"
          className="nb-btn-secondary rounded-full px-3.5 py-1.5 text-[12px] font-semibold no-underline"
        >
          {t("schedule")}
        </Link>
      </div>
    </article>
  );
}
